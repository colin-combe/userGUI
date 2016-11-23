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
        //$baseDir = $_SESSION["baseDir"];
        pg_query("BEGIN") or die("Could not start transaction\n");
        
        $isSuperUser = isSuperUser ($dbconn, $_SESSION['user_id']);

        if ($isSuperUser) {
            $deleteUserInGroup = pg_prepare($dbconn, "deleteUserInGroup", "DELETE FROM user_in_group WHERE user_id = $1");
            $result = pg_execute($dbconn, "deleteUserInGroup", [$_POST["id"]]);
            $deleteUser = pg_prepare($dbconn, "deleteUser", "DELETE FROM users WHERE id = $1");
            $result = pg_execute($dbconn, "deleteUser", [$_POST["id"]]);
            $returnRow = pg_fetch_assoc ($result); // return the inserted row (or selected parts thereof)
        } else {
            throw new Exception ("You don't have permission to delete a user");
        }

         pg_query("COMMIT");
         echo (json_encode(array ("status"=>"success", "deletedUser"=>$returnRow)));
    } catch (Exception $e) {
         pg_query("ROLLBACK");
         $date = date("d-M-Y H:i:s");
         $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when removing a user from the database";
         echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
    }

    //close connection
    pg_close($dbconn);
}
?>