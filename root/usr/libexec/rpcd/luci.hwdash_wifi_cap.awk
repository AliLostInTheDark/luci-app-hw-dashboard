BEGIN {
    print "{"
    first_phy = 1
}
/^Wiphy/ {
    if (!first_phy) { print_phy() }
    phy = $2
    delete enabled; delete disabled; delete exceptions; delete bands
    max_cw = "20 MHz"
    max_spatial = 1
    band = ""
}
/Band 1:/ { band="2.4GHz"; bands[band]=1 }
/Band 2:/ { band="5GHz"; bands[band]=1 }
/Band 3:/ { band="6GHz"; bands[band]=1 }
/Band 4:/ { band="60GHz"; bands[band]=1 }
/Frequencies:/ { in_freq=1; next }
/^[ \t]*\*/ && in_freq {
    match($0, /\[([0-9]+)\]/, arr)
    ch = arr[1]
    if (ch != "") {
        if ($0 ~ /disabled/) {
            disabled[band] = disabled[band] (disabled[band]==""?"":",") ch
        } else {
            enabled[band] = enabled[band] (enabled[band]==""?"":",") ch
            if ($0 ~ /no IR/ || $0 ~ /radar/) {
                exceptions[band] = exceptions[band] (exceptions[band]==""?"":",") ch
            }
        }
    }
}
/Capabilities:/ { in_freq=0 }
/HT20\/HT40/ || /HT40/ { if (max_cw == "20 MHz") max_cw = "40 MHz" }
/VHT Capabilities/ { if (max_cw ~ /20|40/) max_cw = "80 MHz" }
/Supported Channel Width:.*160/ { if (max_cw !~ /320/) max_cw = "160 MHz" }
/Supported Channel Width:.*80\+80/ { if (max_cw !~ /160|320/) max_cw = "80+80 MHz" }
/EHT PHY Capabilities/ { in_eht=1 }
in_eht && /Supported Channel Width:.*320/ { max_cw = "320 MHz" }
/RX.*MCS.*spatial streams/ {
    match($0, /([0-9]+) spatial streams/, arr)
    if (arr[1]+0 > max_spatial) max_spatial = arr[1]+0
}

function print_phy() {
    if (!first_phy) print ","
    first_phy = 0
    printf "  \"%s\": {\n", phy
    printf "    \"max_cw\": \"%s\",\n", max_cw
    printf "    \"max_spatial\": %d,\n", max_spatial
    printf "    \"bands\": {\n"
    first_band = 1
    for (b in bands) {
        if (!first_band) print ","
        first_band = 0
        printf "      \"%s\": {\n", b
        printf "        \"enabled\": [%s],\n", enabled[b]
        printf "        \"disabled\": [%s],\n", disabled[b]
        printf "        \"exceptions\": [%s]\n", exceptions[b]
        printf "      }"
    }
    if (!first_band) print ""
    printf "    }\n  }"
}
END {
    if (phy != "") { print_phy(); print "\n}" } else { print "}" }
}
