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
        
        $isSuperUser = isSuperUser ($dbconn, $_SESSION['user_id']);
        
        // replace empty strings with nulls
        foreach($_POST as $key => $value){
            if ($value === "") {
                $_POST[$key] = null;
            }
        }
        
        if (isset($_POST["newPassword"]) && !filter_var ($_POST["newPassword"], FILTER_VALIDATE_REGEXP, array ('options' => array ('regexp' => '/.{6,}/')))) {
            throw new Exception ("The new password must be at least 6 characters long.");
        } else {
            
            // Check for non-unique username here so we can chuck the error gracefully with a user-friendly message rather than some sql constraint error rhubarb
            /*
            $preparedStr = "SELECT COUNT (user_name) FROM users WHERE id <> $1 AND user_name = $2";
            $uniqueName = pg_prepare($dbconn, "uniqueName", $preparedStr);
            $result = pg_execute($dbconn, "uniqueName", [$_POST["id"], $_POST["user_name"]]);
            $returnRow = pg_fetch_assoc ($result);
            if ($returnRow["count"] > 0) throw new Exception ("The username '".$_POST["user_name"]."' is already taken by another user. Choose another name.");
            */
            
            $hash = $_POST["newPassword"] ? password_hash ($_POST["newPassword"], PASSWORD_BCRYPT) : "";

            if ($isSuperUser) {
                //$preparedStr = "UPDATE users SET user_name = $2, super_user = $3, can_add_search = $4, see_all = $5, email = $6".($hash ? ", password = $7":"")." WHERE id = $1";
                $preparedStr = "UPDATE users SET super_user = $3, can_add_search = $4, see_all = $5, email = $6".($hash ? ", password = $7":"")." WHERE id = $1";
                $qParams = [$_POST["id"], $_POST["user_name"], $_POST["super_user"], $_POST["can_add_search"], $_POST["see_all"], $_POST["email"], $hash];
                if (!$hash) {
                    array_pop($qParams);
                }
                $updateUser = pg_prepare($dbconn, "updateUser", $preparedStr);
                $result = pg_execute($dbconn, "updateUser", $qParams);
                $returnRow = pg_fetch_assoc ($result); // return the inserted row (or selected parts thereof)
            } else {
                // only change if session id equals post id (stops client sending spurious post ids to try and change other people's details)
                if ($_POST['id'] === $_SESSION['user_id']) {
                    //$preparedStr = "UPDATE users SET user_name = $2, email = $3".($hash ? ", password = $4":"")." WHERE id = $1";
                    $preparedStr = "UPDATE users SET email = $3".($hash ? ", password = $4":"")." WHERE id = $1";
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