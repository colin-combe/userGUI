<?php
include ('../../connectionString.php');
include ('utils.php');

try {
    error_log (print_r ($_POST, true));
    
    $ptoken = "";
    if (isset($_POST['token'])){
        $ptoken=$_POST['token'];
    }
    if (!$ptoken || !filter_var ($ptoken, FILTER_VALIDATE_REGEXP, array ('options' => array ('regexp' => '/.{28,}/')))) {
      echo (json_encode(array ("status"=>"fail", "msg"=> "No valid token received.")));
      exit;
    }
    
    $pword = "";
    if (isset($_POST['new-login-pass'])){
        $pword=$_POST['new-login-pass'];
    }
    if (!$pword || !filter_var ($pword, FILTER_VALIDATE_REGEXP, array ('options' => array ('regexp' => '/.{6,}/')))) {
        echo (json_encode(array ("status"=>"fail", "field"=> "new-login-pass")));
        exit;
    }
        
    $dbconn = pg_connect($connectionString);
    try {
        //$baseDir = $_SESSION["baseDir"];
        pg_query("BEGIN") or die("Could not start transaction\n");

        /* test if token exists */
        pg_prepare ($dbconn, "doesTokenExist", "SELECT * FROM users WHERE ptoken = $1 AND ptoken <> ''");
        $result = pg_execute($dbconn, "doesTokenExist", [$ptoken]);
        $count=intval(pg_numrows($result));
        
        if ($count == 1) {
            $returnRow = pg_fetch_assoc ($result);
            $id = $returnRow['id'];
            error_log (print_r ($returnRow, true));
            $hash = password_hash ($pword, PASSWORD_BCRYPT);
            pg_prepare ($dbconn, "setNewPassword", "UPDATE users SET password = $2, ptoken = '' WHERE id = $1");
            $result = pg_execute($dbconn, "setNewPassword", [$id, $hash]);
            
            pg_query("COMMIT");
            $json = json_encode(array ("status"=>"success", "msg"=> "Password reset complete. Thankyou."));
            echo ($json);
        } else {
            pg_query("COMMIT");
            $json = json_encode(array ("status"=>"fail", "msg"=> "Token not matched to any user. Password update failed."));
            echo ($json);
        }

    } catch (Exception $e) {
         pg_query("ROLLBACK");
         $date = date("d-M-Y H:i:s");
         $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when resetting a password";
         echo (json_encode(array ("status"=>"fail", "msg"=> $msg."<br>".$date)));
    }

    //close connection
    pg_close($dbconn);

} catch (Exception $e) {
     $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when resetting a password";
     error_log (print_r ($msg, true));
     echo (json_encode(array ("status"=>"fail", "msg"=> $msg."<br>".$date)));
}

?>