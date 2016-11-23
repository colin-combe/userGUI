<?php
include ('../../connectionString.php');
include ('utils.php');

try {
    error_log (print_r ($_POST, true));
    
    $captcha = "";
    if (isset($_POST['g-recaptcha-response'])){
        $captcha=$_POST['g-recaptcha-response'];
    }
    if(!$captcha){
      echo (json_encode(array ("status"=>"fail", "field"=> "recaptchaWidget")));
      exit;
    }
    
    // validate email
    $email = "";
    if (isset($_POST['email'])){
        $email = $_POST['email'];
    }
    if (!$email || !filter_var ($email, FILTER_VALIDATE_EMAIL) 
        || !filter_var ($email, FILTER_VALIDATE_REGEXP, array ('options' => array ('regexp' => '/\b[\w\.-]+@((?!gmail|googlemail|yahoo|hotmail).)[\w\.-]+\.\w{2,4}\b/')))) {
        echo (json_encode(array ("status"=>"fail", "field"=> "email")));
        exit;
    }
    
    // validate username
    $username = "";
    if (isset($_POST['username'])){
        $username = $_POST['username'];
    }
    if (!$username || !filter_var ($username, FILTER_VALIDATE_REGEXP, array ('options' => array ('regexp' => '/^[a-zA-Z0-9-_]{4,16}/')))) {
        echo (json_encode(array ("status"=>"fail", "field"=> "username")));
        exit;
    }
    
    // validate passwords
    $pword = "";
    if (isset($_POST['pass'])){
        $pword = $_POST['pass'];
    }
    if (!$pword || !filter_var ($pword, FILTER_VALIDATE_REGEXP, array ('options' => array ('regexp' => '/.{6,}/')))) {
        echo (json_encode(array ("status"=>"fail", "field"=> "pass")));
        exit;
    }
    
    // validate captcha
    $ip = $_SERVER['REMOTE_ADDR'];
    $response=file_get_contents("https://www.google.com/recaptcha/api/siteverify?secret=".$secretRecaptchaKey."&response=".$captcha."&remoteip=".$ip);
    $responseKeys = json_decode($response,true);
    error_log (print_r ($responseKeys, true));
    if (intval($responseKeys["success"]) !== 1) {
        echo (json_encode(array ("status"=>"fail", "msg"=> "Captcha failure.")));
        exit;
    } 
        
    $dbconn = pg_connect($connectionString);
    try {
        //$baseDir = $_SESSION["baseDir"];
        pg_query("BEGIN") or die("Could not start transaction\n");

        /* test if username already exists */
        pg_prepare ($dbconn, "doesUserExist", "SELECT COUNT(user_name) FROM users WHERE user_name = $1;");
        $result = pg_execute($dbconn, "doesUserExist", [$username]);
        $returnRow = pg_fetch_assoc ($result);
        if (intval($returnRow["count"]) > 0) {
            echo (json_encode(array ("status"=>"fail", "field"=> "username", "msg"=>"< The username ".$username." is already taken. Please choose another.")));
            exit;
        }

        // database has 20 character limit on user_name field, throws sql error if bigger
        // limit use of existing user_name to generate new name, as if it's 20 chars the new name would be identical and this will throw an error too
        $tempUser = $username;
        $hash = $pword ? password_hash ($pword, PASSWORD_BCRYPT) : "";
        $newUser = pg_prepare($dbconn, "newUser", "INSERT INTO users (user_name, password, see_all, can_add_search, super_user, email, max_aas, max_spectra) VALUES($1, $3, FALSE, FALSE, FALSE, $2, 100000000, 100000) RETURNING id, user_name");
        $result = pg_execute($dbconn, "newUser", [$tempUser, $email, $hash]);
        $returnRow = pg_fetch_assoc ($result); // return the inserted row (or selected parts thereof)
        $returnedID = $returnRow["id"];

        $addUserToGroup = pg_prepare($dbconn, "addUserToGroup", "INSERT INTO user_in_group (user_id, group_id) VALUES($1, $2)");
        $result = pg_execute($dbconn, "addUserToGroup", [$returnedID, "12"]);

         pg_query("COMMIT");

        require_once    ('../vendor/php/PHPMailer-master/class.phpmailer.php');
        require_once    ('../vendor/php/PHPMailer-master/class.smtp.php');

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
        $mail->MsgHTML("Password: ".$pword);
        $mail->AddAddress($email, "USER NAME");

        // $mail->AddAttachment("images/phpmailer.gif");        // attachment
        // $mail->AddAttachment("images/phpmailer_mini.gif");   // attachment

        if(!$mail->Send()) {
             error_log (print_r ("failsend", true));
            echo json_encode (array ("status"=>"fail", "error"=>"Mailer Error: ".$mail->ErrorInfo));
        } 
        else {
            $json = json_encode(array ("status"=>"success", "msg"=> "New user ".$username." added", "username"=>$username));
            echo ($json);
        }

        /*
        $headers = $headers = 'From: webmaster@example.com' . "\r\n" .
            'Reply-To: webmaster@example.com' . "\r\n" .
            'X-Mailer: PHP/' . phpversion()
        ;
        $accept = mail ($email, "Xi Registration", "Password: ".$pword1, $headers);
        error_log (print_r ($accept, true));

        $json = json_encode(array ("status"=>"success", "msg"=> "Accepted."));
        echo ($json);
        */
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