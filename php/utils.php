<?php
    //include('../../connectionString.php');

    // from http://stackoverflow.com/questions/2021624/string-sanitizer-for-filename
    function normalizeString ($str = '') {
        $str = filter_var ($str, FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_LOW);
        $str = preg_replace('/[\"\*\/\:\<\>\?\'\|]+/', ' ', $str);
        $str = html_entity_decode( $str, ENT_QUOTES, "utf-8" );
        $str = htmlentities($str, ENT_QUOTES, "utf-8");
        $str = preg_replace("/(&)([a-z])([a-z]+;)/i", '$2', $str);
        $str = str_replace(' ', '-', $str);
        $str = rawurlencode($str);
        $str = str_replace('%', '-', $str);
        return $str;
    }

    function getLastSearchID ($dbconn) {
        pg_prepare ($dbconn, "getLastSearchID", "SELECT id FROM search WHERE uploadedby = $1 ORDER BY id DESC LIMIT 1");
        $result = pg_execute($dbconn, "getLastSearchID", array($_SESSION['user_id']));
        $lastSearchID = resultsAsArray($result);
        
        //error_log (print_r($lastSearchID, TRUE));

        return count($lastSearchID) == 0 ? null : $lastSearchID[0]["id"];
    }


    function getDefaults ($dbconn, $searchID) {
        pg_prepare($dbconn, "getParamSettings", "SELECT * from parameter_set WHERE parameter_set.id = (SELECT paramset_id FROM search WHERE search.id = $1)");
        $result = pg_execute($dbconn, "getParamSettings", array($searchID));
        $paramSettings = resultsAsArray($result);
        $defaults = array ();
        
        //error_log ("SID ".$searchID);
        //error_log (print_r($paramSettings, TRUE));
        //error_log ("PID ".$paramSettings[0]["id"]);

        if (count($paramSettings) > 0) {
            $pSettings = $paramSettings[0];
            $pid = $pSettings["id"];

            $defaults = array (
                "ms_tol" => $pSettings["ms_tol"],
                "ms2_tol" => $pSettings["ms2_tol"],
                "ms_tol_unit" => $pSettings["ms_tol_unit"],
                "ms2_tol_unit" => $pSettings["ms2_tol_unit"],
                "missed_cleavages" => $pSettings["missed_cleavages"],
                "enzyme" => $pSettings["enzyme_chosen"],
                "customsettings" => $pSettings["customsettings"]
            );

            $getParamMultiOptions = array (
                "ions" => "SELECT ion_id FROM chosen_ions WHERE paramset_id = $1",
                "crosslinkers" => "SELECT crosslinker_id FROM chosen_crosslinker WHERE paramset_id = $1",
                "losses" => "SELECT loss_id FROM chosen_losses WHERE paramset_id = $1",
                "fixedMods" => "SELECT mod_id FROM chosen_modification WHERE paramset_id = $1 AND fixed = TRUE",
                "varMods" => "SELECT mod_id FROM chosen_modification WHERE paramset_id = $1 AND fixed = FALSE",
            );
            
            $getSearchSingleResults = array (
                "notes" => "SELECT notes FROM search WHERE id = $1"
            );
            
            $getSearchMultiOptions = array (
                "acquisitions" => "SELECT DISTINCT acq_id FROM search_acquisition WHERE search_id = $1",
                "sequences" => "SELECT seqdb_id FROM search_sequencedb WHERE search_id = $1"
            );

            foreach ($getParamMultiOptions as $key => $value) {
                pg_prepare ($dbconn, $key, $value);
                $result = pg_execute ($dbconn, $key, array($pid));
                $defaults[$key] = resultsAsArray($result);
            }
            
            foreach ($getSearchSingleResults as $key => $value) {
                pg_prepare ($dbconn, $key, $value);
                $result = pg_execute ($dbconn, $key, array($searchID));
                $defaults[$key] = pg_fetch_row($result)[0];
                //error_log (print_r($result, TRUE));
            }
            
            foreach ($getSearchMultiOptions as $key => $value) {
                pg_prepare ($dbconn, $key, $value);
                $result = pg_execute ($dbconn, $key, array($searchID));
                $defaults[$key] = resultsAsArray($result);
            }
        }
        
        //error_log (print_r($defaults, TRUE));

        return $defaults;
    }


    function getGlobalDefaults ($dbconn) {

        $defaults = array (
            "ms_tol" => 6,
            "ms2_tol" => 20,
            "ms_tol_unit" => "ppm",
            "ms2_tol_unit" => "ppm",
            "missed_cleavages" => 4,
            "notes" => "",
            "customsettings" => "",
            "acquisitions" => array(),
            "sequences" => array()
        );
        
        $getMultiOptions = array (
            "enzyme" => "SELECT id FROM enzyme WHERE is_default = TRUE",
            "ions" => "SELECT id FROM ion WHERE is_default = TRUE",
            "crosslinkers" => "SELECT id FROM crosslinker WHERE is_default = TRUE",
            "losses" => "SELECT id FROM loss WHERE is_default = TRUE",
            "fixedMods" => "SELECT id FROM modification WHERE is_default_fixed = TRUE",
            "varMods" => "SELECT id FROM modification WHERE is_default_var = TRUE",
        );
            
        foreach ($getMultiOptions as $key => $value) {
            pg_prepare ($dbconn, $key, $value);
            $result = pg_execute ($dbconn, $key, array());
            $defaults[$key] = resultsAsArray($result);
        }
        
        //error_log (print_r($defaults, TRUE));
        
        return $defaults;
    }


    // Turn result set into array of objects
    function resultsAsArray($result) {
        $arr = array();
        while ($line = pg_fetch_array($result, null, PGSQL_ASSOC)) {
            $arr[] = $line;
        }

        // free resultset
        pg_free_result ($result);

        return $arr;
    }

?>