<?php
include ('../../connectionString.php');
include ('utils.php');

try {
    error_log (print_r ($_POST, true));
    
    $pid = validatePostVar ("password-retrieve", '/.{6,}/');
        
    $dbconn = pg_connect($connectionString);
    try {
        //$baseDir = $_SESSION["baseDir"];
        pg_query("BEGIN") or die("Could not start transaction\n");

        /* test if username already exists */
        pg_prepare ($dbconn, "doesEmailExist", "SELECT id, email FROM users WHERE user_name = $1 OR email = $1");
        $result = pg_execute($dbconn, "doesEmailExist", [$pid]);
        $count=intval(pg_numrows($result));
        $returnRow = pg_fetch_assoc ($result);
        $email = $returnRow['email'];
        $id = $returnRow['id'];
        error_log (print_r ($result, true));    
        
        require_once    ('../vendor/php/PHPMailer-master/class.phpmailer.php');
        require_once    ('../vendor/php/PHPMailer-master/class.smtp.php');

        if (filter_var ($email, FILTER_VALIDATE_EMAIL)) {
            $mail = makePHPMailerObj ($mailInfo, $email, "Xi Password Reset");

            if ($count == 1) {
                $ptoken = chr( mt_rand( 97 ,122 ) ) .substr( md5( time( ) ) ,1 );
                pg_prepare ($dbconn, "setToken", "UPDATE users SET ptoken = $2 WHERE id = $1");
                $result = pg_execute ($dbconn, "setToken", [$id, $ptoken]);
                error_log (print_r (pg_fetch_assoc ($result), true));
                
                $url = $urlRoot."userGUI/passwordReset.html?ptoken=".$ptoken;
                $mail->MsgHTML("Use this link to reset your Xi account's password<br><A href='".$url."'>".$url."</A>");
                error_log (print_r ($ptoken, true));
                error_log (print_r ($id, true));
                pg_prepare ($dbconn, "getToken", "SELECT * FROM users WHERE ptoken = $1");
                $result2 = pg_execute ($dbconn, "getToken", [$ptoken]);
                error_log (print_r (pg_fetch_assoc ($result2), true));
                pg_query("COMMIT");
                
            } else {
                $mail->MsgHTML ("Someone is trying to access an account with this email at xi.bio.ed.ac.uk");
            }
            
            if(!$mail->Send()) {
                error_log (print_r ("failsend", true));
            } 
        }

        $json = json_encode(array ("status"=>"success", "msg"=> "An email has been sent. Please follow the instructions within."));
        echo ($json);
    } catch (Exception $e) {
         pg_query("ROLLBACK");
         $date = date("d-M-Y H:i:s");
         $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when attempting to send a retrieve password email";
        error_log (print_r ($msg, true));
         echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
    }

    //close connection
    pg_close($dbconn);

} catch (Exception $e) {
    $date = date("d-M-Y H:i:s");
     $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when attempting to connect to the xi database";
    error_log (print_r ($msg, true));
     echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
}

?>