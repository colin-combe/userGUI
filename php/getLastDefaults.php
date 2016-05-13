<?php
    session_start();
    if (!array_key_exists("session_name", $_SESSION) || !$_SESSION['session_name']) {
        // from http://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
        echo (json_encode (array ("redirect" => "./login.html")));
    }
    else {
        include 'utils.php';
        include('../../connectionString.php');
        
        $dbconn = pg_connect($connectionString);
        $sid = getLastSearchID ($dbconn);
        
        if ($sid != null) {
            $defaults = getDefaults ($dbconn, $sid);
            pg_close($dbconn);
            echo json_encode ($defaults);
        } else {
            pg_close($dbconn);
            echo json_encode (array("error" => "no_results_returned"));
        }
    }
?>