<?php
session_start();
if (!array_key_exists("session_name", $_SESSION) || !$_SESSION['session_name']) {
    header("location:login.html");
}

$pageName = "New Search";

include('../../connectionStringSafePDO.php');

try {
    $conn = new PDO($connectionStringPDO);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Get previous acquisitions from DB
    $res = $conn->query ("SELECT acquisition.id, name AS Name, to_char(upload_date, 'YYYY-MM-DD HH:MI') AS Date, users.user_name AS User from acquisition JOIN users ON (acquisition.uploadedby = users.id) where uploadedby = " . $_SESSION['user_id'] . " ORDER BY upload_date DESC;");
    $previousAcqui = resultsAsArray($res);

    // Get previous acquisitions from DB
    $res = $conn->query ("SELECT sequence_file.id, name AS Name, to_char(upload_date, 'YYYY-MM-DD HH:MI') AS Date, users.user_name AS User from sequence_file JOIN users ON (sequence_file.uploadedby = users.id) where uploadedby = " . $_SESSION['user_id'] . " ORDER BY upload_date DESC;");
    $previousSeq = resultsAsArray($res);

    // Get crosslinkers from DB
    $res = $conn->query ("SELECT id, name, is_default from crosslinker WHERE name NOT LIKE '#%' ORDER by name;");
    $xlinkers = resultsAsArray($res);

    // Get enzymes from DB
    $res = $conn->query ("SELECT id, name, is_default from enzyme ORDER by name;");
    $enzymes = resultsAsArray($res);

    // Get modifications from DB
    $res = $conn->query ("SELECT id, name, is_default_fixed, is_default_var from modification WHERE name NOT LIKE '#%' ORDER by name;");
    $mods = resultsAsArray($res);

    // Get ions from DB
    $res = $conn->query ("SELECT id, name, is_default from ion WHERE name NOT LIKE '#%' ORDER by name;");
    $ions = resultsAsArray($res);

    // Get losses from DB
    $res = $conn->query ("SELECT id, name, is_default from loss WHERE name NOT LIKE '#%' ORDER by name;");
    $losses = resultsAsArray($res);

    // Get basedir for file uploads
    $res = $conn->query ("SELECT setting FROM base_setting WHERE name='base_directory_path';");
    $baseDir = $res->fetch(PDO::FETCH_BOTH)[0];

    // Store this server side 'cos we don't need it client side
    $_SESSION["baseDir"] = $baseDir;
    
    $conn = null;
    
    echo json_encode (array(
        "xlinkers" => $xlinkers, "enzymes" => $enzymes, "previousAcqui" => $previousAcqui, "previousSeq" => $previousSeq,
        "ions" => $ions, "modifications" => $mods, "losses" => $losses
    ));
    
} catch(Exception $e) {
    echo (json_encode (array ("error" => $e->getMessage())));
}


// Printing results in HTML, assuming id and name field in result set
function resultsAsArray($result) {
    //echo "<p>".$result."</p>";
    $arr = array();
    while ($line = $result->fetch(PDO::FETCH_ASSOC)) {
        $arr[] = $line;
    }
    
    // free resultset
    $result = null;
    
    return $arr;
}

?>