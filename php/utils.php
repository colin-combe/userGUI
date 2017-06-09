<?php
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
        
        $canSeeAll = (isset($row["see_all"]) && $row["see_all"] === 't');  // 1 if see_all flag is true or if that flag doesn't exist in the database 
        $canAddNewSearch = (isset($row["can_add_search"]) && $row["can_add_search"] === 't');  // 1 if can_add_search flag is true or if that flag doesn't exist in the database 
        $isSuperUser = (isset($row["super_user"]) && $row["super_user"] === 't');  // 1 if super_user flag is present AND true
        $maxAAs = 0; //isset($row["max_aas"]) ? (int)$row["max_aas"] : 0;   // max aas and spectra now decided by user groups table
        $maxSpectra = 0; //isset($row["max_spectra"]) ? (int)$row["max_spectra"] : 0;
        $maxSearchCount = 10000;
        $maxSearchLifetime = 1000;
        $maxSearchesPerDay = 100;
        $searchDenyReason = null;
        
        if (doesColumnExist ($dbconn, "user_groups", "max_aas")) {
            pg_prepare($dbconn, "user_rights2", "SELECT max(user_groups.max_search_count) as max_search_count, max(user_groups.max_spectra) as max_spectra, max(user_groups.max_aas) as max_aas, max(user_groups.search_lifetime_days) as max_search_lifetime, max(user_groups.max_searches_per_day) as max_searches_per_day,
            MAX(CAST(user_groups.see_all as INT)) AS see_all,
            MAX(CAST(user_groups.super_user as INT)) AS super_user,
            MAX(CAST(user_groups.can_add_search as INT)) AS can_add_search
            FROM user_groups
            JOIN user_in_group ON user_in_group.group_id = user_groups.id
            JOIN users ON users.id = user_in_group.user_id
            WHERE users.id = $1");
            $result = pg_execute ($dbconn, "user_rights2", [$userID]);
            $row = pg_fetch_assoc ($result);
            //error_log (print_r ($row, true));
            
            $maxSearchCount = (int)$row["max_search_count"];
            $maxSearchLifetime = (int)$row["max_search_lifetime"];
            $maxSearchesPerDay = (int)$row["max_searches_per_day"];
            $maxAAs = max($maxAAs, (int)$row["max_aas"]);
            $maxSpectra = max($maxSpectra, (int)$row["max_spectra"]);
            $canSeeAll = $canSeeAll || ((!isset($row["see_all"]) || (int)$row["see_all"] === 1));
            $canAddNewSearch = $canAddNewSearch || (!isset($row["can_add_search"]) || (int)$row["can_add_search"] === 1);
            $isSuperUser = $isSuperUser || (isset($row["super_user"]) && (int)$row["super_user"] === 1); 
            
            if ($canAddNewSearch) {
                $userSearches = countUserSearches ($dbconn, $userID);
                if ($maxSearchCount !== null && $userSearches >= $maxSearchCount) {
                    $canAddNewSearch = false;
                    $searchDenyReason = "You already have ".$maxSearchCount." or more active searches. Consider hiding some of them to allow new searches.";
                }
            }
                  
            if ($canAddNewSearch) {
                $userSearchesToday = countUserSearchesToday ($dbconn, $userID);
                if ($maxSearchesPerDay !== null && $userSearchesToday >= $maxSearchesPerDay) {
                    $canAddNewSearch = false;
                    $searchDenyReason = "Limit met. Your user profile is restricted to ".$maxSearchesPerDay." new search(es) per day.";
                }
            }
        } else {
            $maxAAs = max($maxAAs, 1000);
            $maxSpectra = max($maxSpectra, 1000000);
        }
          
        return array ("canSeeAll"=>$canSeeAll, "canAddNewSearch"=>$canAddNewSearch, "isSuperUser"=>$isSuperUser, "maxAAs"=>$maxAAs, "maxSpectra"=>$maxSpectra, "maxSearchLifetime"=>$maxSearchLifetime, "maxUserSearches"=>$maxSearchCount, "maxUserSearchesToday"=>$maxSearchesPerDay, "searchDenyReason"=>$searchDenyReason);
    }

    // Number of searches by a particular user performed today
    function countUserSearchesToday ($dbconn, $userID) {
        pg_prepare ($dbconn, "activeUserSearchesToday", "SELECT COUNT(id) FROM search WHERE uploadedby = $1 AND (hidden ISNULL or hidden = 'f') AND submit_date::date = now()::date");
        $result = pg_execute ($dbconn, "activeUserSearchesToday", [$userID]);
        $row = pg_fetch_assoc ($result);
        return (int)$row["count"];
    }

    // Number of searches by a particular user
    function countUserSearches ($dbconn, $userID) {
        pg_prepare ($dbconn, "activeUserSearches", "SELECT COUNT(id) FROM search WHERE uploadedby = $1 AND (hidden ISNULL or hidden = 'f')");
        $result = pg_execute ($dbconn, "activeUserSearches", [$userID]);
        $row = pg_fetch_assoc ($result);
        return (int)$row["count"];
    }

    function doesColumnExist ($dbconn, $tableName, $columnName) {
        pg_prepare($dbconn, "doesColExist", "SELECT COUNT(column_name) FROM information_schema.columns WHERE table_name=$1 AND column_name=$2");
        $result = pg_execute ($dbconn, "doesColExist", [$tableName, $columnName]);
        $row = pg_fetch_assoc ($result);
        return ((int)$row["count"] === 1);
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
        //error_log (print_r ($a, true));
        if (!$a || ($isEmail && !filter_var ($a, FILTER_VALIDATE_EMAIL)) || !filter_var ($a, FILTER_VALIDATE_REGEXP, array ('options' => array ('regexp' => $regexp)))) {
            if (isset($msg)) {
                echo (json_encode(array ("status"=>"fail", "msg"=> $msg, "error"=> $msg)));
            } else {
                echo (json_encode(array ("status"=>"fail", "field"=> (isset($altFormFieldID) ? $altFormFieldID: $varName), "error"=> "Input validation failed")));
            }
            exit;
        }
        return $a;
    }

    function validateCaptcha ($captcha) {
        include ('../../../xi_ini/emailInfo.php');
        
        $ip = $_SERVER['REMOTE_ADDR'];
        $response=file_get_contents("https://www.google.com/recaptcha/api/siteverify?secret=".$secretRecaptchaKey."&response=".$captcha."&remoteip=".$ip);
        $responseKeys = json_decode($response,true);
        //error_log (print_r ($responseKeys, true));
        if (intval($responseKeys["success"]) !== 1) {
            echo (json_encode(array ("status"=>"fail", "msg"=> getTextString("captchaError"), "revalidate"=> true)));
            exit;
        } 
    }

    function makePhpMailerObj ($myMailInfo, $toEmail, $userName="User Name", $subject="Test Send Mails") {
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
        $mail->AddAddress($toEmail, $userName);
        
        // $mail->AddAttachment("images/phpmailer.gif");        // attachment
        return $mail;
    }

    function sendPasswordResetMail ($email, $id, $userName, $count, $dbconn) {
        include ('../../../xi_ini/emailInfo.php');
        require_once    ('../vendor/php/PHPMailer-master/class.phpmailer.php');
        require_once    ('../vendor/php/PHPMailer-master/class.smtp.php');
        
        //error_log (print_r ($email, true));
        
        if (strlen($email) > 2) {
            if (filter_var ($email, FILTER_VALIDATE_EMAIL)) {

                if ($count == 1) {
                    //error_log (print_r ($count, true));
                    $mail = makePHPMailerObj ($mailInfo, $email, $userName, getTextString("resetPasswordEmailHeader"));
                    $ptoken = chr( mt_rand( 97 ,122 ) ) .substr( md5( time( ) ) ,1 );
                    pg_prepare ($dbconn, "setToken", "UPDATE users SET ptoken = $2, ptoken_timestamp = now() WHERE id = $1");
                    $result = pg_execute ($dbconn, "setToken", [$id, $ptoken]);
                    //error_log (print_r (pg_fetch_assoc ($result), true));

                    if ($result) {
                        $url = $urlRoot."userGUI/passwordReset.html?ptoken=".$ptoken;
                        $mail->MsgHTML (getTextString ("resetPasswordEmailBody", [$url]));
                        //error_log (print_r ($ptoken, true));
                        //error_log (print_r ($id, true));

                        pg_query("COMMIT");

                        if(!$mail->Send()) {
                            //error_log (print_r ("failsend", true));
                        }   
                    } else {
                        throw new Exception (getTextString("genDatabaseError"));
                    }
                } else {
                    throw new Exception (getTextString("emailTaken"));
                }
            } else {
                throw new Exception (getTextString("emailInvalid"));
            }
        } else {
            throw new Exception (getTextString("emailEmpty"));
        }
    }

    function getTextString ($key, $vars = NULL) {
        if (!isset($_strings)) {
            //error_log ("init strings");
            $_strings = json_decode (file_get_contents ("../json/msgs.json"), true);
        }
        $lang = "en";
        $str = $_strings[$lang][$key];
        if ($vars) {
            $str = preg_replace(array('/\$1/', '/\$2/', '/\$3/', '/\$4/', '/\$5/', '/\$6/', '/\$7/', '/\$8/', '/\$9/'), $vars, $str);
        }
        //error_log (print_r ($str, true));
        return $str;
    }
?>