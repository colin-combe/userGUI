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

    // database connection needs to be open and user logged in for this function to work
    function isSuperUser ($dbconn) {
        pg_prepare ($dbconn, "isSuperUser", "SELECT super_user FROM users WHERE id = $1");
        $result = pg_execute($dbconn, "isSuperUser", [$_SESSION['user_id']]);
        $firstRow = pg_fetch_assoc ($result); // get first row (should be only one)
        $isSuperUser = $firstRow["super_user"];
        return $isSuperUser !== "t";
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