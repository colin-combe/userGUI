    <div class="login">

          <form id="login_form" name="login_form" method="post" action="../userGUI/php/checkLogin.php" class="login-form">
            <div class="control-group">
                <label for="login-name">Username</label>
                <input type="text" value="" placeholder="Username" id="login-name" name="login-name" pattern="^[a-zA-Z0-9-_.]{4,16}" oninput="this.setCustomValidity('')" required autofocus/>
                <span class="error" id="login-name-errorMsg"></span>
                <span class="error2"></span>
            </div>

            <div class="control-group">
              <label for="login-pass">Password</label>
              <input type="password" value="" placeholder="Password" id="login-pass" name="login-pass" required/>
              <span class="error2"></span>
            </div>

            <input name="Submit" value="Login To Xi" type="submit" class="btn btn-1a"/>
          </form>

        <hr class="wideDivider">
        <h3>Forgotten Password?</h3>
        <form id="reset_password_form" name="reset_password_form" action="../userGUI/userRequestPassword.html">
            <input name="Submit" value="Reset Password" type="submit" class="btn btn-1a"/>
        </form>

        <div class="newUserSection">
            <hr class="wideDivider">
            <h3>New User?</h3>
            <form id="new_user_form" name="new_user_form" action="./createAccount.php">
                <input name="Submit" value="Create New Account" type="submit" class="btn btn-1a"/>
            </form>
        </div>

        <script type="text/javascript">
            $(document).ready(function(e) {
                $.when (
                    $.getJSON("../userGUI/json/config.json"),
                    $.getJSON("../userGUI/json/msgs.json")
                ).done (function (configxhr, msgsxhr) {
                    var msgs = msgsxhr[0];
                    var config = configxhr[0];
                    CLMSUI.loginForms.msgs = msgs;
                    CLMSUI.loginForms.makeFooter();
                    CLMSUI.loginForms.makeHelpButton();

                    // function checkConnection (url) {
                    //     $.ajax({
                    //         url: url,
                    //         cache: false,
                    //         timeout:1000,
                    //         error: function (jqXHR, textStatus) {
                    //             //alert("Request failed: " + textStatus );
                    //         },
                    //         success: function () {
                                $(".newUserSection").css("display", "block");
                     //        }
                     //    });
                     // }
                     // checkConnection("./createAccount.php"); // show new user section if reg page is reachable

                     var nameValidationMsg = CLMSUI.loginForms.getMsg("clientNameValidationInfo");
                    $("#login-name").attr("oninvalid", "this.setCustomValidity('"+nameValidationMsg+"')");
                    $("#login-name-errorMsg").text("< "+nameValidationMsg);

                    // divert form submit action to this javascript function
                    $("#login_form").submit (function(e) {
                        $(".error2").css("display", "none");
                        CLMSUI.loginForms.ajaxPost (e.target);
                        e.preventDefault();
                    });
                 });
            });
        </script>
    </div>
