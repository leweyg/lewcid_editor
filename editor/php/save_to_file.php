
<?php

$userPath = $_GET['path'];
# echo "Path=" . $userPath;
$userContent = file_get_contents('php://input');
# echo "Content=" . $userContent;
# return;
file_put_contents($userPath, $userContent);
echo "Done."
?>