<?php
include ('../../connectionString.php');
include ('utils.php');

try {
    error_log (print_r ($_POST, true));
    
    $pid = validatePostVar ("password-retrieve", '/.{4,}/', false, null, "Needs to be at least 4 characters");

    $dbconn = pg_connect($connectionString);

    try {
        //$baseDir = $_SESSION["baseDir"];
        pg_query("BEGIN") or die("Could not start transaction\n");

        /* test if username already exists */
        pg_prepare ($dbconn, "doesEmailExist", "SELECT id, email FROM users WHERE user_name = $1 OR email = $1");
        $result = pg_execute($dbconn, "doesEmailExist", [$pid]);
        $count = intval(pg_numrows($result));
        $returnRow = pg_fetch_assoc ($result); 

        sendPasswordResetMail ($returnRow['email'], $returnRow['id'], $count, $dbconn);

        echo (json_encode(array ("status"=>"success", "msg"=> "An email has been sent. Please follow the instructions within.")));
    } catch (Exception $e) {
         pg_query("ROLLBACK");
         $date = date("d-M-Y H:i:s");
         $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when attempting to send a retrieve password email";
        error_log (print_r ($msg, true));
         echo (json_encode(array ("status"=>"fail", "msg"=> $msg." ".$date)));
    }

    //close connection
    pg_close($dbconn);

} catch (Exception $e) {
    $date = date("d-M-Y H:i:s");
     $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when attempting to connect to the xi database";
    error_log (print_r ($msg, true));
     echo (json_encode(array ("status"=>"fail", "msg"=> $msg." ".$date)));
}

?>