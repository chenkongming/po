@echo off
if not exist www mkdir www
copy /Y index.html www\
copy /Y app.js www\
copy /Y styles.css www\
copy /Y quotes.js www\
copy /Y success-quotes.js www\
copy /Y ranks.js www\
