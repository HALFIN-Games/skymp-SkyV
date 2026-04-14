# Usage: "cmake -P generate_server_settings.cmake -DESM_PREFIX=<prefix_here> -DSERVER_SETTINGS_JSON_PATH=<path_to_server_settings.json> -DOFFLINE_MODE=<true_or_false>"
# Optional:
# -DSERVER_SETTINGS_TEMPLATE_JSON_PATH=<path_to_repo_template_json>

set(SERVER_SETTINGS_JSON "")

# Prefer a repo template if provided.
if(SERVER_SETTINGS_TEMPLATE_JSON_PATH AND EXISTS "${SERVER_SETTINGS_TEMPLATE_JSON_PATH}")
    file(READ "${SERVER_SETTINGS_TEMPLATE_JSON_PATH}" SERVER_SETTINGS_JSON)
elseif(EXISTS "${SERVER_SETTINGS_JSON_PATH}")
    file(READ "${SERVER_SETTINGS_JSON_PATH}" SERVER_SETTINGS_JSON)
else()
    set(SERVER_SETTINGS_JSON "{}")
endif()

# Ensure required keys exist (do not override if already present).
if(NOT SERVER_SETTINGS_JSON)
    set(SERVER_SETTINGS_JSON "{}")
endif()

if(NOT "${SERVER_SETTINGS_JSON}" MATCHES "\\\"dataDir\\\"")
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "dataDir" "\"data\"")
endif()

if(NOT "${SERVER_SETTINGS_JSON}" MATCHES "\\\"name\\\"")
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "name" "\"My Server\"")
endif()

if(NOT "${SERVER_SETTINGS_JSON}" MATCHES "\\\"loadOrder\\\"")
    set(load_order Skyrim.esm Update.esm Dawnguard.esm HearthFires.esm Dragonborn.esm)
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "loadOrder" "[0,0,0,0,0]")
    foreach(index RANGE 0 4)
        list(GET load_order ${index} ESM)
        string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "loadOrder" ${index} "\"${ESM_PREFIX}${ESM}\"")
    endforeach()
endif()

if(NOT "${SERVER_SETTINGS_JSON}" MATCHES "\\\"npcEnabled\\\"")
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "npcEnabled" "false")
endif()

if(NOT "${SERVER_SETTINGS_JSON}" MATCHES "\\\"port\\\"")
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "port" "7777")
endif()

if(NOT "${SERVER_SETTINGS_JSON}" MATCHES "\\\"maxPlayers\\\"")
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "maxPlayers" "100")
endif()

if(NOT "${SERVER_SETTINGS_JSON}" MATCHES "\\\"npcSettings\\\"")
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "npcSettings" "{}")
endif()

# If we are using an ESM_PREFIX, ensure loadOrder entries include it.
if(ESM_PREFIX)
    string(JSON _loadOrder GET "${SERVER_SETTINGS_JSON}" "loadOrder")
    if(_loadOrder)
        string(JSON _len LENGTH "${SERVER_SETTINGS_JSON}" "loadOrder")
        math(EXPR _last "${_len} - 1")
        foreach(i RANGE 0 ${_last})
            string(JSON _entry GET "${SERVER_SETTINGS_JSON}" "loadOrder" ${i})
            string(FIND "${_entry}" "${ESM_PREFIX}" _pos)
            if(_pos EQUAL -1)
                string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "loadOrder" ${i} "\"${ESM_PREFIX}${_entry}\"")
            endif()
        endforeach()
    endif()
endif()

if(OFFLINE_MODE)
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "offlineMode" "true")
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "master" "\"\"")
else()
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "offlineMode" "false")
    string(JSON SERVER_SETTINGS_JSON SET "${SERVER_SETTINGS_JSON}" "master" "\"https://gateway.skymp.net\"")
endif()

file(WRITE "${SERVER_SETTINGS_JSON_PATH}" "${SERVER_SETTINGS_JSON}")

if(SERVER_SETTINGS_BASE_JSON_PATH)
  file(WRITE "${SERVER_SETTINGS_BASE_JSON_PATH}" "${SERVER_SETTINGS_JSON}")
endif()
