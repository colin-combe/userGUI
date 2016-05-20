<?php
session_start();
if (!array_key_exists("session_name", $_SESSION) || !$_SESSION['session_name']) {
    // from http://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
    echo (json_encode (array ("redirect" => "./login.html")));
}
else { 
    include('../../connectionString.php');
    include('utils.php');
    
    $dbconn = pg_connect($connectionString);
    try {
        //$baseDir = $_SESSION["baseDir"];
        pg_query("BEGIN") or die("Could not start transaction\n");
        
        $isSuperUser = isSuperUser ($dbconn);

        if ($isSuperUser) {
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