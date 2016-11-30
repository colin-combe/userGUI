<?php
include ('../../connectionString.php');
include ('utils.php');

try {
    error_log (print_r ($_POST, true));

    $captcha = validatePostVar ("g-recaptcha-response", '/.{1,}/', false, "recaptchaWidget");
    $email = validatePostVar ("email", '/\b[\w\.-]+@((?!gmail|googlemail|yahoo|hotmail).)[\w\.-]+\.\w{2,4}\b/', true);
    $username = validatePostVar ("username", '/^[a-zA-Z0-9-_]{4,16}/');
    $pword = validatePostVar ("pass", '/.{6,}/');
       
    // validate captcha
    validateCaptcha ($captcha);
        
    $dbconn = pg_connect($connectionString);
    try {
        /* test if username already exists */
        pg_prepare ($dbconn, "doesUserExist", "SELECT COUNT(user_name) FROM users WHERE user_name = $1;");
        $result = pg_execute($dbconn, "doesUserExist", [$username]);
        $returnRow = pg_fetch_assoc ($result);
        if (intval($returnRow["count"]) > 0) {
            echo (json_encode(array ("status"=>"fail", "field"=> "username", "msg"=>"< The username ".$username." is already taken. Please choose another.", "revalidate"=> true)));
            exit;
        }
        
        /* test if email already exists */
        pg_prepare ($dbconn, "doesEmailExist", "SELECT COUNT(email) FROM users WHERE email = $1;");
        $result = pg_execute($dbconn, "doesEmailExist", [$email]);
        $returnRow = pg_fetch_assoc ($result);
        if (intval($returnRow["count"]) > 0) {
            echo (json_encode(array ("status"=>"fail", "field"=> "email", "msg"=>"< The email address ".$email." is already in use. Please choose another.", "revalidate"=> true)));
            exit;
        }

        // database has 20 character limit on user_name field, throws sql error if bigger
        // limit use of existing user_name to generate new name, as if it's 20 chars the new name would be identical and this will throw an error too
        pg_query("BEGIN") or die("Could not start transaction\n");
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

        $mail = makePHPMailerObj ($mailInfo, $email, "Xi Registration");
        $mail->MsgHTML("You're now registered with Xi! Your account is set up but needs to be approved by an administrator for search privileges which can take up to 3 days. We thankyou for your patience.");
        
        if(!$mail->Send()) {
             error_log (print_r ("failsend", true));
            echo json_encode (array ("status"=>"fail", "msg"=>"Mailer Error: ".$mail->ErrorInfo, "revalidate"=> true));
        } 
        else {
            $json = json_encode(array ("status"=>"success", "msg"=> "New user ".$username." added. A confirmation email has been sent.", "username"=>$username));
            echo ($json);
        }
    } catch (Exception $e) {
         pg_query("ROLLBACK");
         $date = date("d-M-Y H:i:s");
         $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when adding a new user to the database";
         echo (json_encode(array ("status"=>"fail", "msg"=> $msg."<br>".$date, "revalidate"=> true)));
    }

    //close connection
    pg_close($dbconn);

} catch (Exception $e) {
     $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when adding a new user to the database";
     error_log (print_r ($msg, true));
     echo (json_encode(array ("status"=>"fail", "msg"=> $msg."<br>".$date)));
}

?>