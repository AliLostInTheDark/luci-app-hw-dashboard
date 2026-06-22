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
/Band 1:/ || /Band 2\.4/ { band="2.4GHz" }
/Band 2:/ || /Band 5/ { band="5GHz" }
/Band 3:/ || /Band 6/ { band="6GHz" }
/Band 4:/ || /Band 60/ { band="60GHz" }
/Frequencies:/ { in_freq=1; next }
/^[ \t]*\*?/ && in_freq {
    match($0, /\[([0-9]+)\]/, arr)
    ch = arr[1]
    
    match($0, /([0-9]+) MHz/, f_arr)
    freq = f_arr[1] + 0
    
    if (ch != "" && freq > 0) {
        if (freq >= 2400 && freq < 2500) temp_band = "2.4GHz"
        else if (freq >= 5000 && freq < 5900) temp_band = "5GHz"
        else if (freq >= 5900 && freq < 7200) temp_band = "6GHz"
        else if (freq >= 58000 && freq < 65000) temp_band = "60GHz"
        else temp_band = band
        
        if (temp_band == "") temp_band = "Unknown"
        bands[temp_band] = 1
        
        if ($0 ~ /disabled/) {
            disabled[temp_band] = disabled[temp_band] (disabled[temp_band]==""?"":",") ch
        } else {
            enabled[temp_band] = enabled[temp_band] (enabled[temp_band]==""?"":",") ch
            if ($0 ~ /no IR/ || $0 ~ /radar/) {
                exceptions[temp_band] = exceptions[temp_band] (exceptions[temp_band]==""?"":",") ch
            }
        }
    }
}
/Capabilities:/ || /^Wiphy/ || /^[a-zA-Z]/ { if ($0 !~ /Frequencies:/) in_freq=0 }
/HT20\/HT40/ || /HT40/ { if (max_cw == "20 MHz") max_cw = "40 MHz" }
/VHT Capabilities/ { if (max_cw ~ /20|40/) max_cw = "80 MHz" }
/Supported Channel Width:.*160/ { if (max_cw !~ /320/) max_cw = "160 MHz" }
/Supported Channel Width:.*80\+80/ { if (max_cw !~ /160|320/) max_cw = "80+80 MHz" }
/EHT PHY Capabilities/ { in_eht=1 }
in_eht && /Supported Channel Width:.*320/ { max_cw = "320 MHz" }

/RX spatial streams: [0-9]+/ {
    match($0, /RX spatial streams: ([0-9]+)/, arr)
    if (arr[1]+0 > max_spatial) max_spatial = arr[1]+0
}
/^[ \t]*([0-9]+) streams: MCS/ {
    match($0, /([0-9]+) streams:/, arr)
    if (arr[1]+0 > max_spatial) max_spatial = arr[1]+0
}
/spatial streams\)/ {
    match($0, /([0-9]+) spatial streams\)/, arr)
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
