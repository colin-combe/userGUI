<?php
include ('../../connectionString.php');
include ('utils.php');

try {
    error_log (print_r ($_POST, true));
    
    $pid = "";
    if (isset($_POST['password-retrieve'])){
        $pid=$_POST['password-retrieve'];
    }
    if(!$pid){
      echo (json_encode(array ("status"=>"fail", "field"=> "password-retrieve")));
      exit;
    }
        
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
            $mail               = new PHPMailer();
            $mail->IsSMTP();                                        // telling the class to use SMTP
            $mail->SMTPDebug    = 0;                                // 1 enables SMTP debug information (for testing) - but farts it out to echo, knackering json
            $mail->SMTPAuth     = true;                             // enable SMTP authentication
            $mail->SMTPSecure   = "tls";                            // sets the prefix to the servier
            $mail->Host         = "smtp.gmail.com";                 // sets GMAIL as the SMTP server
            $mail->Port         = 587;                              // set the SMTP port for the GMAIL server

            $mail->Username     = $gmailAccount.'@gmail.com';           // GMAIL username
            $mail->Password     = $gmailPassword;           // GMAIL password

            $mail->SetFrom($gmailAccount.'@gmail.com', 'Xi');
            $mail->Subject    = "Test Send Mails";
            $mail->AddAddress($email, "USER NAME");

            // $mail->AddAttachment("images/phpmailer.gif");        // attachment
            // $mail->AddAttachment("images/phpmailer_mini.gif");   // attachment

            if ($count == 1) {
                $token = chr( mt_rand( 97 ,122 ) ) .substr( md5( time( ) ) ,1 );
                pg_prepare ($dbconn, "setToken", "UPDATE users SET token = $2 WHERE id = $1");
                $result = pg_execute ($dbconn, "setToken", [$id, $token]);
                error_log (print_r (pg_fetch_assoc ($result), true));
                $mail->MsgHTML("Use this link to reset your Xi password<br><A href='http://www.xi3.bio.ed.ac.uk'>".$token."</A>");
                error_log (print_r ($token, true));
                error_log (print_r ($id, true));
            } else {
                $mail->MsgHTML("Someone is trying to access an account with this email at xi.bio.ed.ac.uk");
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
         $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when adding a new user to the database";
         echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
    }

    //close connection
    pg_close($dbconn);

} catch (Exception $e) {
     $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when adding a new user to the database";
     error_log (print_r ($msg, true));
     echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
}

?>