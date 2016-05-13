<?php
session_start();
if (!array_key_exists("session_name", $_SESSION) || !$_SESSION['session_name']) {
    // from http://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
    echo (json_encode (array ("redirect" => "./login.html")));
}
else {

    include('../../connectionString.php');
    include('utils.php');

    try {
        //open connection
        $dbconn = pg_connect($connectionString);
        
        $possibleValues = array();
        
        $getFieldValues = array (
            "enzymes" => "SELECT id, name from enzyme ORDER by name",
            "ions" => "SELECT id, name from ion ORDER by name",
            "xlinkers" => "SELECT id, name from crosslinker ORDER by name",
            "losses" => "SELECT id, name from loss ORDER by name",
            "modifications" => "SELECT id, name from modification ORDER by name",
            "previousAcqui" => "SELECT acquisition.id, name AS Name, to_char(upload_date, 'YYYY-MM-DD HH24:MI') AS Date, users.user_name AS User from acquisition JOIN users ON (acquisition.uploadedby = users.id) ORDER BY acquisition.id DESC",
            "previousSeq" => "SELECT sequence_file.id, name AS Name, file_name as file, to_char(upload_date, 'YYYY-MM-DD HH24:MI') AS Date, users.user_name AS User from sequence_file JOIN users ON (sequence_file.uploadedby = users.id) ORDER BY upload_date DESC",
            "filenames" => "SELECT acq_id, name FROM run ORDER by acq_id DESC"
        );
            
        foreach ($getFieldValues as $key => $value) {
            pg_prepare ($dbconn, $key, $value);
            $result = pg_execute ($dbconn, $key, array());
            $possibleValues[$key] = resultsAsArray($result);
        }

        // Get basedir for file uploads
        $query = "SELECT setting FROM base_setting WHERE name='base_directory_path';";
        $baseDir = pg_fetch_row(pg_query($query))[0];

        // Store this server side 'cos we don't need it client side
        $_SESSION["baseDir"] = $baseDir;

        //close connection
        pg_close($dbconn);

        echo json_encode ($possibleValues);
    }
    catch (Exception $e) {
        $date = date("d-M-Y H:i:s");
        echo (json_encode (array ("error" => "Error when querying database for default values<br>".$date)));
    }
}

?>