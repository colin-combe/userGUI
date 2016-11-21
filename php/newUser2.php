<?php
session_start();
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
    
    // validate passwords
    $pword1 = "";
    if (isset($_POST['pass1'])){
        $pword1 = $_POST['pass1'];
    }
    $pword2 = "";
    if (isset($_POST['pass2'])){
        $pword2 = $_POST['pass2'];
    }
    if (!filter_var ($pword1, FILTER_VALIDATE_REGEXP, array ('options' => array ('regexp' => '/.{6,}/')))) {
        echo (json_encode(array ("status"=>"fail", "field"=> "pass1")));
        exit;
    }
    if (!filter_var ($pword2, FILTER_VALIDATE_REGEXP, array ('options' => array ('regexp' => '/.{6,}/')))) {
        echo (json_encode(array ("status"=>"fail", "field"=> "pass2")));
        exit;
    }
    if ($pword1 !== $pword2) {
        echo (json_encode(array ("status"=>"fail", "field"=> "pass2")));
        exit;
    }
    
    // validate captcha
    $ip = $_SERVER['REMOTE_ADDR'];
    $response=file_get_contents("https://www.google.com/recaptcha/api/siteverify?secret=".$secretRecaptchaKey."&response=".$captcha."&remoteip=".$ip);
    $responseKeys = json_decode($response,true);
    error_log (print_r ($responseKeys, true));
    if (intval($responseKeys["success"]) !== 1) {
        echo (json_encode(array ("status"=>"fail", "msg"=> "Spammer.")));
    } else {
        $headers = $headers = 'From: webmaster@example.com' . "\r\n" .
            'Reply-To: webmaster@example.com' . "\r\n" .
            'X-Mailer: PHP/' . phpversion()
        ;
        $accept = mail ($email, "Xi Registration", "Password: ".$pword1, $headers);
        error_log (print_r ($accept, true));
        
        $json = json_encode(array ("status"=>"success", "msg"=> "Accepted."));
        echo ($json);
    }
} catch (Exception $e) {
     $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when adding a new user to the database";
     error_log (print_r ($msg, true));
     echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
}

?>