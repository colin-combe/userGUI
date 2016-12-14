<?php
session_start();
include ('utils.php');
if (empty ($_SESSION['session_name'])) {
    // from http://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
    ajaxLoginRedirect();
}
else {

    include('../../connectionString.php');

    try {
        //open connection
        $dbconn = pg_connect($connectionString);
        
        $isSuperUser = isSuperUser ($dbconn, $_SESSION['user_id']);
        
        if ($isSuperUser) {
             //pg_prepare ($dbconn, "allUserInfo", "SELECT id, user_name, see_all, can_add_search, super_user, email FROM users, user_in_group JOIN users.id = user_in_group.id");
             pg_prepare ($dbconn, "allUserInfo", "SELECT users.id, user_name, see_all, can_add_search, super_user, email, array_agg(user_in_group.group_id) AS user_group FROM users JOIN user_in_group ON user_in_group.user_id = users.id GROUP BY users.id");
             $result = pg_execute($dbconn, "allUserInfo", []);
             pg_prepare ($dbconn, "allGroupInfo", "SELECT * FROM user_groups");
             $groupResult = pg_execute($dbconn, "allGroupInfo", []);
            $groupData = pg_fetch_all ($groupResult);
        } else {
             //pg_prepare ($dbconn, "singleUserInfo", "SELECT id, user_name, email FROM users WHERE id = $1");
             pg_prepare ($dbconn, "singleUserInfo", "SELECT users.id, user_name, see_all, can_add_search, super_user, email, array_agg(user_in_group.group_id) AS user_group FROM users JOIN user_in_group ON user_in_group.user_id = users.id WHERE users.id = $1 GROUP BY users.id"); 
             $result = pg_execute($dbconn, "singleUserInfo", [$_SESSION['user_id']]);
             //$groupData = [];
            pg_prepare ($dbconn, "allGroupInfo", "SELECT * FROM user_groups");
             $groupResult = pg_execute($dbconn, "allGroupInfo", []);
            $groupData = pg_fetch_all ($groupResult);
        }
        
        $returnedData = pg_fetch_all ($result);
        
        for ($i=0; $i<count($returnedData); $i++) {
            $returnedData[$i]['user_group'] = explode(",", trim($returnedData[$i]['user_group'], '{}'));    // explode string to array
            $returnedData[$i]['user_group'] = array_diff ($returnedData[$i]['user_group'], array("NULL"));  // Strip out nulls
        }
             
        //close connection
        pg_close($dbconn);

        echo json_encode (array ("status" => "success", "data" => $returnedData, "groupTypeData" => $groupData, "superuser" => $isSuperUser, "userid" => $_SESSION["user_id"]));
    }
    catch (Exception $e) {
        $date = date("d-M-Y H:i:s");
        echo (json_encode (array ("error" => "Error when querying database for user<br>".$date)));
    }
}

?>