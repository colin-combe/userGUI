<?php
session_start();
if (!array_key_exists("session_name", $_SESSION) || !$_SESSION['session_name']) {
    // from http://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
    echo (json_encode (array ("redirect" => "./login.html")));
}
else { 
    include('../../connectionString.php');
    $dbconn = pg_connect($connectionString);
    try {
        //$baseDir = $_SESSION["baseDir"];
        pg_query("BEGIN") or die("Could not start transaction\n");
        
        pg_prepare ($dbconn, "isSuperUser", "SELECT super_user FROM users WHERE id = $1");
        $result = pg_execute($dbconn, "isSuperUser", [$_SESSION['user_id']]);
        $firstRow = pg_fetch_assoc ($result); // get first row (should be only one)
        $isSuperUser = $firstRow["super_user"];

        if ($isSuperUser !== "t") { // should be === 't' for real user
            $newUser = pg_prepare($dbconn, "newUser", "INSERT INTO users (user_name, see_all, super_user, email) VALUES('new user 3', FALSE, FALSE, NULL) RETURNING id"); // can't have same user name for two accounts, need fix
            $result = pg_execute($dbconn, "newUser", []);
            $returnRow = pg_fetch_assoc ($result); // return the inserted row (or selected parts thereof)
        } else {
            throw new Exception ("You do not have permission to create a new user");
        }

         pg_query("COMMIT");
         echo (json_encode(array ("status"=>"success", "newUser"=>$returnRow)));
    } catch (Exception $e) {
         pg_query("ROLLBACK");
         $date = date("d-M-Y H:i:s");
        $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when initialising a new user into the database";
         echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
    }

    //close connection
    pg_close($dbconn);
}
?>