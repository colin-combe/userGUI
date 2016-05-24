<?php
session_start();
if (!array_key_exists("session_name", $_SESSION) || !$_SESSION['session_name']) {
    // from http://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
    echo (json_encode (array ("redirect" => "../searches/login.html")));
}
else {

    include('../../connectionString.php');
    include('utils.php');

    try {
        //open connection
        $dbconn = pg_connect($connectionString);
        
        $isSuperUser = isSuperUser ($dbconn);
        
        if ($isSuperUser) {
             pg_prepare ($dbconn, "allUserInfo", "SELECT id, user_name, see_all, super_user, email FROM users");
             $result = pg_execute($dbconn, "allUserInfo", []);
        } else {
             pg_prepare ($dbconn, "singleUserInfo", "SELECT id, user_name, email FROM users WHERE id = $1");
             $result = pg_execute($dbconn, "singleUserInfo", [$_SESSION['user_id']]);
        }
        
        $returnedData = pg_fetch_all ($result);
        foreach ($returnedData as $key => $value) {
            // $value["newPassword"] = 'jhjhj'; doesn't work, $value is a copy, not a reference to the original
            $returnedData[$key]["newPassword"] = '';
        }
        
        //error_log(print_r($returnedData, true));
        //error_log(print_r($_SESSION, true));
             
        //close connection
        pg_close($dbconn);

        echo json_encode (array ("status" => "success", "data" => $returnedData, "superuser" => $isSuperUser));
    }
    catch (Exception $e) {
        $date = date("d-M-Y H:i:s");
        echo (json_encode (array ("error" => "Error when querying database for user<br>".$date)));
    }
}

?>