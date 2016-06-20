<?php
    //include('../../connectionString.php');

    // from http://stackoverflow.com/questions/2021624/string-sanitizer-for-filename
    function normalizeString($str = '') {
        $str = filter_var($str, FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_LOW);
        $str = preg_replace('/[\"\*\/\:\<\>\?\'\|]+/', ' ', $str);
        $str = html_entity_decode($str, ENT_QUOTES, "utf-8");
        $str = htmlentities($str, ENT_QUOTES, "utf-8");
        $str = preg_replace("/(&)([a-z])([a-z]+;)/i", '$2', $str);
        $str = str_replace(' ', '-', $str);
        $str = rawurlencode($str);
        $str = str_replace('%', '-', $str);
        return $str;
    }

    // database connection needs to be open and user logged in for these functions to work
    function isSuperUser($dbconn, $userID) {
        $rights = getUserRights ($dbconn, $userID);
        return $rights["isSuperUser"];
    }

    function getUserRights ($dbconn, $userID) {
        pg_prepare($dbconn, "user_rights", "SELECT * FROM users WHERE id = $1");
        $result = pg_execute ($dbconn, "user_rights", [$userID]);
        $row = pg_fetch_assoc ($result);
        //error_log (print_r ($row, true));
        $canSeeAll = (!isset($row["see_all"]) || $row["see_all"] === 't');  // 1 if see_all flag is true or if that flag doesn't exist in the database 
        $canAddNewSearch = (!isset($row["can_add_search"]) || $row["can_add_search"] === 't');  // 1 if can_add_search flag is true or if that flag doesn't exist in the database 
        $isSuperUser = (isset($row["super_user"]) && $row["super_user"] === 't');  // 1 if super_user flag is present AND true
        return array ("canSeeAll"=>$canSeeAll, "canAddNewSearch"=>$canAddNewSearch, "isSuperUser"=>$isSuperUser);
    }

    // Turn result set into array of objects
    function resultsAsArray($result) {
        $arr = array();
        while ($line = pg_fetch_array($result, null, PGSQL_ASSOC)) {
            $arr[] = $line;
        }

        // free resultset
        pg_free_result($result);

        return $arr;
    }

?>