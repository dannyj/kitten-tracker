#!/usr/bin/env bash
#
# host-firewall.sh — network-lateral-movement controls for the kitten-app box.
# Run ON THE DOCKER HOST (192.168.80.125), as root/sudo. Idempotent: re-running
# replaces the rules it manages; it never touches Docker's own chains.
#
# Rules live in the DOCKER-USER chain (the supported hook that iptables
# evaluates BEFORE Docker's auto-generated rules) and are scoped to the
# kitten_proxy subnet, so they can't affect unrelated containers.
#
#   path 2  — block the kitten_proxy subnet from reaching NPM's admin port (81).
#             NPM admin stays reachable from the LAN; only container-sourced
#             traffic to :81 is dropped.
#   path 3  — block the app from pivoting onto the LAN / other private networks:
#             host SSH (192.168.80.125), Pi-hole (192.168.80.34), any other
#             Docker bridge. Intra-kitten_proxy traffic (the npm<->app proxy
#             flow) is preserved; public-internet egress is left open because
#             the ts-kitten sidecar needs it to reach the tailnet.
#
# SCOPE / HONEST LIMITS:
#   * This stops LAN pivots and reaching other containers — the high-value
#     targets. It does NOT stop HTTPS exfil/C2 to the public internet: a
#     port-based allowlist can't tell Tailscale's DERP-on-443 from evil.com:443.
#     Closing that needs an egress proxy, which is out of scope here. Tailscale
#     ACLs (docs/tailscale-policy.hujson) cover the tailnet-peer direction.
#
# Usage:
#   sudo ./host-firewall.sh apply     # install/refresh the rules
#   sudo ./host-firewall.sh clear     # remove just the rules this script adds
#   sudo ./host-firewall.sh status    # show the managed rules
#
# CAVEAT: DOCKER-USER is recreated empty when the Docker daemon restarts. Re-run
# `apply` after a daemon restart (or wire it to a @reboot job — see README
# "Host network lockdown"). After apply, confirm Tailscale is unaffected:
#   docker exec ts-kitten tailscale status
#
set -euo pipefail

NET="kitten_proxy"
MARK="kitten-fw"   # comment tag so we can find/remove only our own rules

require_root() { [ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)"; exit 1; }; }

discover() {
  command -v docker >/dev/null || { echo "docker not found"; exit 1; }
  SUBNET=$(docker network inspect "$NET" -f '{{(index .IPAM.Config 0).Subnet}}' 2>/dev/null) \
    || { echo "network $NET not found — is the stack up?"; exit 1; }
  NPM_IP=$(docker inspect npm -f "{{(index .NetworkSettings.Networks \"$NET\").IPAddress}}" 2>/dev/null || true)
  echo "kitten_proxy subnet : $SUBNET"
  echo "npm IP on subnet    : ${NPM_IP:-<not on $NET>}"
}

clear_rules() {
  # Delete every DOCKER-USER rule carrying our comment until none remain.
  while iptables -S DOCKER-USER 2>/dev/null | grep -q -- "--comment \"$MARK"; do
    line=$(iptables -S DOCKER-USER | grep -m1 -- "--comment \"$MARK" | sed 's/^-A/-D/')
    # shellcheck disable=SC2086
    iptables $line
  done
}

apply_rules() {
  discover
  clear_rules

  # -I inserts at the TOP, so the LAST insert is matched FIRST. Insert in
  # reverse of the desired match order. Desired top-down match order:
  #   1. DROP   app -> npm:81
  #   2. RETURN intra-subnet (npm<->app proxy flow must survive)
  #   3. DROP   app -> 192.168.0.0/16   (LAN: host SSH, Pi-hole)
  #   4. DROP   app -> 10.0.0.0/8
  #   5. DROP   app -> 172.16.0.0/12    (other Docker bridges)
  # Public-internet dests match none of these and fall through (allowed).

  iptables -I DOCKER-USER -s "$SUBNET" -d 172.16.0.0/12  -j DROP   -m comment --comment "$MARK:lan-172"
  iptables -I DOCKER-USER -s "$SUBNET" -d 10.0.0.0/8     -j DROP   -m comment --comment "$MARK:lan-10"
  iptables -I DOCKER-USER -s "$SUBNET" -d 192.168.0.0/16 -j DROP   -m comment --comment "$MARK:lan-192"
  iptables -I DOCKER-USER -s "$SUBNET" -d "$SUBNET"      -j RETURN -m comment --comment "$MARK:intra"

  if [ -n "${NPM_IP:-}" ]; then
    iptables -I DOCKER-USER -s "$SUBNET" -d "$NPM_IP" -p tcp --dport 81 -j DROP -m comment --comment "$MARK:npm-admin"
  else
    echo "WARN: npm not attached to $NET — skipping the :81 block."
    echo "      Run 'docker network connect $NET npm' first, then re-apply."
  fi

  echo "applied. managed rules now in DOCKER-USER (top = matched first):"
  status
}

status() { iptables -S DOCKER-USER | grep -- "--comment \"$MARK" || echo "(no $MARK rules present)"; }

require_root
case "${1:-}" in
  apply)  apply_rules ;;
  clear)  clear_rules; echo "cleared $MARK rules." ;;
  status) status ;;
  *) echo "usage: sudo $0 {apply|clear|status}"; exit 2 ;;
esac
