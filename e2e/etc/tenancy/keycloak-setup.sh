#!/usr/bin/env bash
# Identities for the tenancy e2e tests, on top of the realm created by Trustify's
# etc/deploy/compose/config/init-sso/init.sh
set -eo pipefail
KC=${KCADM_PATH:-kcadm.sh}
CFG=$(mktemp)
trap 'rm -f "$CFG"' EXIT
R=trustify
k() { "$KC" "$@" --config "$CFG"; }
"$KC" config credentials --config "$CFG" --server "${KEYCLOAK_URL:-http://localhost:8090}" --realm master --user "${KEYCLOAK_ADMIN:-admin}" --password "${KEYCLOAK_ADMIN_PASSWORD:-admin123456}"

role_id() { k get roles -r $R --fields id,name --format csv --noquotes | grep ",$1\$" | cut -d, -f1; }
scope_id() { k get client-scopes -r $R --fields id,name --format csv --noquotes | grep ",$1\$" | cut -d, -f1; }
client_id() { k get clients -r $R --query exact=true --query "clientId=$1" --fields id --format csv --noquotes; }

# update:document, missing from the default realm setup
k create client-scopes -r $R -s name=update:document -s protocol=openid-connect || true
k create "client-scopes/$(scope_id update:document)/scope-mappings/realm" -r $R -b '[{"name":"trustify-manager","id":"'"$(role_id trustify-manager)"'"}]' || true

# orchestrator: manage.tenancy
k create roles -r $R -s name=trustify-orchestrator || true
k create client-scopes -r $R -s name=trustify:manage -s protocol=openid-connect || true
k create "client-scopes/$(scope_id trustify:manage)/scope-mappings/realm" -r $R -b '[{"name":"trustify-orchestrator","id":"'"$(role_id trustify-orchestrator)"'"}]' || true
k add-roles -r $R --uusername service-account-testing-manager --rolename trustify-orchestrator

for c in frontend testing-manager; do
  k update "clients/$(client_id $c)/default-client-scopes/$(scope_id update:document)" -r $R
done
k update "clients/$(client_id testing-manager)/default-client-scopes/$(scope_id trustify:manage)" -r $R

# public client for password grants of test users
if [[ -z "$(client_id e2e-cli)" ]]; then
  k create clients -r $R -s clientId=e2e-cli -s publicClient=true -s directAccessGrantsEnabled=true \
    -s standardFlowEnabled=false -s fullScopeAllowed=true
fi
for s in read:document create:document update:document delete:document; do
  k update "clients/$(client_id e2e-cli)/default-client-scopes/$(scope_id $s)" -r $R
done

# users, all with full global scopes: the tenancy role bindings decide
for u in alice bob carol; do
  if [[ -z "$(k get users -r $R --query exact=true --query username=$u --fields id --format csv --noquotes)" ]]; then
    k create users -r $R -s username=$u -s enabled=true -s email=$u@example.com -s emailVerified=true \
      -s firstName=${u^} -s lastName=Tester
  fi
  k add-roles -r $R --uusername $u --rolename trustify-manager
  ID=$(k get users -r $R --query exact=true --query username=$u --fields id --format csv --noquotes)
  k update "users/$ID/reset-password" -r $R -s type=password -s value=pass123456 -s temporary=false -n
done
echo e2e identities ready

# complete the profile of the realm's admin user, so logging in doesn't require it
ID=$(k get users -r $R --query exact=true --query username=admin --fields id --format csv --noquotes)
k update "users/$ID" -r $R -s email=admin@example.com -s emailVerified=true -s firstName=Admin -s lastName=Tester
