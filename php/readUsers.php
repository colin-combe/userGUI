<?php
session_start();
include ('../../vendor/php/utils.php');
if (empty ($_SESSION['session_name'])) {
    // from http://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
    ajaxLoginRedirect();
}
else {

    include('../../connectionString.php');

    try {
        //open connection
        $dbconn = pg_connect($connectionString);
        
        $times = [];
        $z = microtime(true);
        $times["startAbsolute"] = $z;
        
        $isSuperUser = isSuperUser ($dbconn, $_SESSION['user_id']);
        $times["isSuperUser"] = microtime(true) - $z;
        $z = microtime(true);

        if ($isSuperUser) {
             //pg_prepare ($dbconn, "allUserInfo", "SELECT id, user_name, see_all, can_add_search, super_user, email FROM users, user_in_group JOIN users.id = user_in_group.id");
             pg_prepare ($dbconn, "allUserInfo", "SELECT users.id, user_name, email, hidden AS delete, array_agg(user_in_group.group_id) AS user_group FROM users JOIN user_in_group ON user_in_group.user_id = users.id GROUP BY users.id");
             $result = pg_execute($dbconn, "allUserInfo", []);
        } else {
             //pg_prepare ($dbconn, "singleUserInfo", "SELECT id, user_name, email FROM users WHERE id = $1");
             pg_prepare ($dbconn, "singleUserInfo", "SELECT users.id, user_name, email, array_agg(user_in_group.group_id) AS user_group FROM users JOIN user_in_group ON user_in_group.user_id = users.id WHERE users.id = $1 GROUP BY users.id"); 
             $result = pg_execute($dbconn, "singleUserInfo", [$_SESSION['user_id']]);
        }     
        $returnedData = pg_fetch_all ($result);
        $times["getUsers"] = microtime(true) - $z;
        $z = microtime(true);
        
        pg_prepare ($dbconn, "allGroupInfo", "SELECT * FROM user_groups ORDER BY can_add_search DESC NULLS LAST, max_search_count DESC NULLS LAST");
        $groupResult = pg_execute($dbconn, "allGroupInfo", []);
        $groupData = pg_fetch_all ($groupResult);
        $times["getGroups"] = microtime(true) - $z;
        $z = microtime(true);
        
        foreach ($returnedData as $i => $row) {
            $ugroupArr = explode(",", trim($row['user_group'], '{}'));    // explode string to array
            $returnedData[$i]['user_group'] = array_diff ($ugroupArr, array("NULL"));  // Strip out nulls   
        }
        $times["attachGroups"] = microtime(true) - $z;
        $times["endAbsolute"] = microtime(true);
        $times["server"] = $times["endAbsolute"] - $times["startAbsolute"];
             
        //close connection
        pg_close($dbconn);

        echo json_encode (array ("status" => "success", "data" => $returnedData, "groupTypeData" => $groupData, "superuser" => $isSuperUser, "userid" => $_SESSION["user_id"], "username" => $_SESSION['session_name'], "times" => $times));
    }
    catch (Exception $e) {
        $date = date("d-M-Y H:i:s");
        echo (json_encode (array ("error" => getTextString("userDatabaseError")."<br>".$date)));
    }
}

?>