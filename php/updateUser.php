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
        pg_query("BEGIN") or die("Could not start transaction\n");
        
        $isSuperUser = isSuperUser ($dbconn);
        
        if ($_POST["newPassword"] && strlen($_POST["newPassword"]) < 7) {
            throw new Exception ("New password must be at least 7 characters long");
        } else {
            $hash = $_POST["newPassword"] ? password_hash ($_POST["newPassword"], PASSWORD_BCRYPT) : "";

            if ($isSuperUser) {
                $preparedStr = "UPDATE users SET user_name = $2, super_user = $3, see_all = $4, email = $5".($hash ? ", password = $6":"")." WHERE id = $1";
                $qParams = [$_POST["id"], $_POST["user_name"], $_POST["super_user"], $_POST["see_all"], $_POST["email"], $hash];
                if (!$hash) {
                    array_pop($qParams);
                }
                $updateUser = pg_prepare($dbconn, "updateUser", $preparedStr);
                $result = pg_execute($dbconn, "updateUser", $qParams);
                $returnRow = pg_fetch_assoc ($result); // return the inserted row (or selected parts thereof)
            } else {
                if ($_POST['id'] === $_SESSION['user_id']) {
                    $preparedStr = "UPDATE users SET user_name = $2, email = $3".($hash ? ", password = $4":"")." WHERE id = $1";
                    $qParams = [$_POST["id"], $_POST["user_name"], $_POST["email"], $hash];
                    if (!$hash) {
                        array_pop($qParams);
                    }
                    $updateUser = pg_prepare($dbconn, "updateUser2", $preparedStr);
                    $result = pg_execute($dbconn, "updateUser2", $qParams);
                    $returnRow = pg_fetch_assoc ($result); // return the inserted row (or selected parts thereof)
                } else {
                    throw new Exception ("You don't have permission to update the details of another user");
                }
            }
        }

         pg_query("COMMIT");
         echo (json_encode(array ("status"=>"success", "updatedUser"=>$returnRow)));
    } catch (Exception $e) {
         pg_query("ROLLBACK");
         $date = date("d-M-Y H:i:s");
         $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when updating a user's details in the database";
         echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
    }

    //close connection
    pg_close($dbconn);
}
?>