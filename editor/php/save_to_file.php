
<?php
$userPath = "../" . $_GET['path'];
$userContent = file_get_contents('php://input');
file_put_contents($userPath, $userContent);
echo "true"
?>