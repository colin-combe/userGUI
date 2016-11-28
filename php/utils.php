<?php
    //include('../../connectionString.php');

    // from http://stackoverflow.com/questions/2021624/string-sanitizer-for-filename
    function normalizeString($str = '') {
        $str = filter_var($str, FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_LOW);
        $str = preg_replace('/[\"\*\/\:\<\>\?\'\|]+/', ' ', $str);
        $str = html_entity_decode($str, ENT_QUOTES, "utf-8");
        $str = htmlentities($str, ENT_QUOTES, "utf-8");
        $str = preg_replace("/(&)([a-z])([a-z]+;)/i", '$2', $str);
        $str = str_replace(' ', '-', $str);
        $str = rawurlencode($str);
        $str = str_replace('%', '-', $str);
        return $str;
    }

    // database connection needs to be open and user logged in for these functions to work
    function isSuperUser($dbconn, $userID) {
        $rights = getUserRights ($dbconn, $userID);
        return $rights["isSuperUser"];
    }

    function getUserRights ($dbconn, $userID) {
        pg_prepare($dbconn, "user_rights", "SELECT * FROM users WHERE id = $1");
        $result = pg_execute ($dbconn, "user_rights", [$userID]);
        $row = pg_fetch_assoc ($result);
        //error_log (print_r ($row, true));
        $canSeeAll = (!isset($row["see_all"]) || $row["see_all"] === 't');  // 1 if see_all flag is true or if that flag doesn't exist in the database 
        $canAddNewSearch = (!isset($row["can_add_search"]) || $row["can_add_search"] === 't');  // 1 if can_add_search flag is true or if that flag doesn't exist in the database 
        $isSuperUser = (isset($row["super_user"]) && $row["super_user"] === 't');  // 1 if super_user flag is present AND true
        return array ("canSeeAll"=>$canSeeAll, "canAddNewSearch"=>$canAddNewSearch, "isSuperUser"=>$isSuperUser);
    }

    // Turn result set into array of objects
    function resultsAsArray($result) {
        $arr = array();
        while ($line = pg_fetch_array($result, null, PGSQL_ASSOC)) {
            $arr[] = $line;
        }

        // free resultset
        pg_free_result($result);

        return $arr;
    }

    function ajaxLoginRedirect () {
        // from http://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
         echo (json_encode (array ("redirect" => "../xi3/login.html")));
    }

    function validatePostVar ($varName, $regexp, $isEmail=false, $altFormFieldID=null, $msg=null) {
        $a = "";
        if (isset($_POST[$varName])){
            $a = $_POST[$varName];
        }
        if (!$a || ($isEmail && !filter_var ($a, FILTER_VALIDATE_EMAIL)) || !filter_var ($a, FILTER_VALIDATE_REGEXP, array ('options' => array ('regexp' => $regexp)))) {
            if (isset($msg)) {
                echo (json_encode(array ("status"=>"fail", "msg"=> $msg)));
            } else {
                echo (json_encode(array ("status"=>"fail", "field"=> (isset($altFormFieldID) ? $altFormFieldID: $varName))));
            }
            exit;
        }
        return $a;
    }

    function makePhpMailerObj ($myMailInfo, $toEmail, $subject="Test Send Mails") {
        $mail               = new PHPMailer();
        $mail->IsSMTP();                                        // telling the class to use SMTP
        $mail->SMTPDebug    = 0;                                // 1 enables SMTP debug information (for testing) - but farts it out to echo, knackering json
        $mail->SMTPAuth     = true;                             // enable SMTP authentication
        $mail->SMTPSecure   = "tls";                            // sets the prefix to the servier
        $mail->Host         = $myMailInfo["host"];                 // sets GMAIL as the SMTP server
        $mail->Port         = $myMailInfo["port"];                              // set the SMTP port for the GMAIL server

        $mail->Username     = $myMailInfo["account"];     // MAIL username
        $mail->Password     = $myMailInfo["password"];    // MAIL password

        $mail->SetFrom($myMailInfo["account"], 'Xi');
        $mail->Subject    = $subject;
        $mail->AddAddress($toEmail, "USER NAME");
        
        // $mail->AddAttachment("images/phpmailer.gif");        // attachment
        // $mail->AddAttachment("images/phpmailer_mini.gif");   // attachment
        return $mail;
    }

    function sendPasswordResetMail ($email, $id, $count, $dbconn) {
        include ('../../connectionString.php');
        require_once    ('../vendor/php/PHPMailer-master/class.phpmailer.php');
        require_once    ('../vendor/php/PHPMailer-master/class.smtp.php');
        
        error_log (print_r ($email, true));
        if (filter_var ($email, FILTER_VALIDATE_EMAIL)) {

            if ($count == 1) {
                error_log (print_r ($count, true));
                $mail = makePHPMailerObj ($mailInfo, $email, "Xi Password Reset");
                $ptoken = chr( mt_rand( 97 ,122 ) ) .substr( md5( time( ) ) ,1 );
                pg_prepare ($dbconn, "setToken", "UPDATE users SET ptoken = $2, ptoken_timestamp = now() WHERE id = $1");
                $result = pg_execute ($dbconn, "setToken", [$id, $ptoken]);
                error_log (print_r (pg_fetch_assoc ($result), true));
                
                $url = $urlRoot."userGUI/passwordReset.html?ptoken=".$ptoken;
                $mail->MsgHTML("Use this link to reset your Xi account's password<br><A href='".$url."'>".$url."</A>");
                error_log (print_r ($ptoken, true));
                error_log (print_r ($id, true));

                pg_query("COMMIT");
                
                if(!$mail->Send()) {
                    error_log (print_r ("failsend", true));
                }   
            } else {
                throw new Exception ("More than one username is registered with this email address.");
            }
        } else {
            throw new Exception ("Invalid email address. Password reset mail cannot be sent.");
        }
    }
?>