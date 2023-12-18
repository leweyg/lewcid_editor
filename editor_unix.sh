#!/bin/bash

# start browser before the server (async)
open http://localhost:1337/index.html

# pass control to php:
exec php -S localhost:1337
