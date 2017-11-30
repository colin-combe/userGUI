        <div class="login">

              <form id="register_form" name="register_form" method="post" action="../userGUI/php/registerNewUser.php" class="login-form">
                  
                <div class="control-group">
                    <label for="email">Pick Username</label>
                    <input type="text" value="" placeholder="Username" id="username" name="username" pattern="^[a-zA-Z0-9-_.]{4,16}" oninput="this.setCustomValidity('')" required autofocus/>
                    <span class="error" id="username-errorMsg"></span>
                    <span class="error2"></span>
                </div>
                  
                <div class="control-group">
                    <label for="email">Email Address</label>
                    <input type="email" value="" placeholder="email@address" id="email" name="email" pattern="" required/>
                    <span class="error" id="email-errorMsg"></span>
                    <span class="error2"></span>
                </div>

                <div class="control-group">
                    <label for="pass1">Pick Password</label>
                    <input type="password" value="" placeholder="Password" id="pass" name="pass" pattern=".{6,}" oninput="this.setCustomValidity('')" required/>
                    <span class="error" id="pass-errorMsg"></span>
                    <input type="checkbox" id="show-password">
                    <label for="show-password">Show password</label>
                </div>
                  
                <div id="recaptchaWidget" data-sitekey="getFromConfig.json"></div>
                <span class="error">&lt; Please check the captcha form</span>
                <br/>
                  
                <input name="Submit" value="Create My Xi Account" type="submit" class="btn btn-1a"/>

              </form>
            
            <div id="spinBox"></div>
            <div id="msg"></div>

            <script type="text/javascript"> 
                //$(document).ready(function(e) {
                var onloadCallback = function () {
                    $.when (
                        $.getJSON("./json/config.json"),
                        $.getJSON("./json/msgs.json")
                    ).done (function (configxhr, msgsxhr) {
                        var config = configxhr[0];
                        var msgs = msgsxhr[0];
                        CLMSUI.loginForms.msgs = msgs;
                        CLMSUI.loginForms.makeFooter();
                        CLMSUI.loginForms.makeHelpButton();
                        CLMSUI.loginForms.finaliseRecaptcha (config.googleRecaptchaPublicKey);
                        var spinner = CLMSUI.loginForms.getSpinner();

                        var splitRegex = config.emailRegex.split("/");
                        $("#email").attr("pattern", splitRegex[1]);

                        var nameValidationMsg = CLMSUI.loginForms.getMsg("clientNameValidationInfo");
                        $("#username").attr("oninvalid", "this.setCustomValidity('"+nameValidationMsg+"')");
                        $("#username-errorMsg").text("< "+nameValidationMsg);

                        var passwordValidationMsg = CLMSUI.loginForms.getMsg("clientPasswordValidationInfo");
                        $("#pass").attr("oninvalid", "this.setCustomValidity('"+passwordValidationMsg+"')");
                        $("#pass-errorMsg").text("< "+passwordValidationMsg);

                        var emailValidationMsg = CLMSUI.loginForms.getMsg("clientEmailValidationInfo");
                        $("#email-errorMsg").text("< "+emailValidationMsg);

                        // Example 3:
                        // - When checkbox changes, toggle password
                        //   visibility based on its 'checked' property
                        $('#show-password').change(function(){
                          $('#pass').hideShowPassword($(this).prop('checked'));
                        });


                        // divert form submit action to this javascript function
                        $("#register_form").submit (function(e) {
                            $(".error2").css("display", "none");
                            spinner.spin (document.getElementById ("spinBox"));
                            CLMSUI.loginForms.ajaxPost (e.target, {"g-recaptcha-response": grecaptcha.getResponse()}, function() { spinner.stop(); });
                            e.preventDefault();
                        });
                    });
                }
                //});
            </script>
            
            <script src="https://www.google.com/recaptcha/api.js?onload=onloadCallback&render=explicit" async defer></script>
        </div>
