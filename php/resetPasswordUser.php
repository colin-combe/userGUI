<?php
session_start();
include ('utils.php');
if (empty ($_SESSION['session_name'])) {
    // from http://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
    ajaxLoginRedirect();
}
else { 
    include('../../connectionString.php');
    
    $dbconn = pg_connect($connectionString);
    try {
        pg_query("BEGIN") or die("Could not start transaction\n");
        error_log (print_r ("resetting pword", true));
        if ($_POST['id'] === $_SESSION['user_id'] || isSuperUser ($dbconn, $_SESSION['user_id'])) {
             error_log (print_r ("user validated", true));
            pg_prepare ($dbconn, "getUserEmail", "SELECT user_name, email FROM users WHERE id = $1");
            $result = pg_execute($dbconn, "getUserEmail", [$_POST['id']]);
            $returnRow = pg_fetch_assoc ($result); // return the inserted row (or selected parts thereof)
            if (isset($returnRow['email'])) {
                $_POST['email'] = $returnRow['email'];
                if (validatePostVar ("email", '/\b[\w\.-]+@((?!gmail|googlemail|yahoo|hotmail).)[\w\.-]+\.\w{2,4}\b/', true)) {
                    error_log (print_r ("email ok", true));
                    sendPasswordResetMail ($returnRow['email'], $_POST['id'], $returnRow['user_name'], 1, $dbconn);
                } else {
                    error_log (print_r ("email malformed", true));
                    throw new Exception ("Stored email address is malformed. Password reset mail cannot be sent.");
                }
            } else {
                throw new Exception ("Stored email address is empty. Password reset mail cannot be sent.");
            }
        } 

         pg_query("COMMIT");
         echo (json_encode(array ("status"=>"success", "updatedUser"=>$returnRow)));
    } catch (Exception $e) {
         pg_query("ROLLBACK");
         $date = date("d-M-Y H:i:s");
         $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when reading a user's details in the database";
         echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
    }

    //close connection
    pg_close($dbconn);
}
?>