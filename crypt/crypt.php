<?php
    $path = "/var/www/mvtest_jlc/images/00000001/";

    for( $i = 1 ; $i <= 33 ; $i++ ){
        $filename = $path . $i . ".jpg";
        $cmd = "./c " . $filename . " enc";
        print $cmd . "\n";
        system( $cmd );
    }
