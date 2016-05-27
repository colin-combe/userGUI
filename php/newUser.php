<?php
session_start();
if (!array_key_exists("session_name", $_SESSION) || !$_SESSION['session_name']) {
    // from http://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
    echo (json_encode (array ("redirect" => "../searches/login.html")));
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
            // database has 20 character limit on user_name field, throws sql error if bigger
            // limit use of existing user_name to generate new name, as if it's 20 chars the new name would be identical and this will throw an error too
            $tempUser = substr($_SESSION['session_name'], 0, 14);
            $len = strlen(utf8_decode($tempUser));
            $newuid = substr(uniqid(), max(0, -7 + $len));  // uniqid() is time-based string, use right-most characters if limited as they are most unique
            $tempUser = substr($tempUser.$newuid, 0, 20);   // limit to 20 chars
            $newUser = pg_prepare($dbconn, "newUser", "INSERT INTO users (user_name, see_all, super_user, email, max_aas, max_spectra) VALUES($1, FALSE, FALSE, NULL, 100000000, 100000) RETURNING id, user_name");
            $result = pg_execute($dbconn, "newUser", [$tempUser]);
            $returnRow = pg_fetch_assoc ($result); // return the inserted row (or selected parts thereof)
            $returnedID = $returnRow["id"];
            
            $addUserToGroup = pg_prepare($dbconn, "addUserToGroup", "INSERT INTO user_in_group (user_id, group_id) VALUES($1, $2)");
            $result = pg_execute($dbconn, "addUserToGroup", [$returnedID, "1"]);
        } else {
            throw new Exception ("You do not have permission to create a new user");
        }

         pg_query("COMMIT");
         echo (json_encode(array ("status"=>"success", "newUser"=>$returnRow)));
    } catch (Exception $e) {
         pg_query("ROLLBACK");
         $date = date("d-M-Y H:i:s");
         $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when adding a new user to the database";
         echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
    }

    //close connection
    pg_close($dbconn);
}
?>