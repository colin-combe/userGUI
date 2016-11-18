<?php
session_start();
include ('../../connectionString.php');
include ('utils.php');

try {
    error_log (print_r ($_POST, true));
    error_log (print_r ($_SERVER, true));
    $captcha = "";
    if(isset($_POST['g-recaptcha-response'])){
        $captcha=$_POST['g-recaptcha-response'];
    }
    if(!$captcha){
      echo (json_encode(array ("status"=>"fail", "error"=> "Please check the the captcha form.")));
      exit;
    }
    $ip = $_SERVER['REMOTE_ADDR'];
    $response=file_get_contents("https://www.google.com/recaptcha/api/siteverify?secret=".$secretRecaptchaKey."&response=".$captcha."&remoteip=".$ip);
    $responseKeys = json_decode($response,true);
    error_log (print_r ($_responseKeys, true));
    if(intval($responseKeys["success"]) !== 1) {
        echo (json_encode(array ("status"=>"fail", "error"=> "Spammer.")));
    } else {
        echo (json_encode(array ("success"=>"fail", "error"=> "Accepted.")));
    }
} catch (Exception $e) {
     $msg = ($e->getMessage()) ? ($e->getMessage()) : "An Error occurred when adding a new user to the database";
     echo (json_encode(array ("status"=>"fail", "error"=> $msg."<br>".$date)));
}

?>