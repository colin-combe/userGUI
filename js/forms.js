var CLMSUI = CLMSUI || {};

CLMSUI.loginForms = {
    
    ajaxPost: function (formElement, prepostData, doneFunc) {
        var zform = $(formElement);
        // grab form input field values and put them in a json obj
        var json = prepostData || {};
        json.redirect = document.referrer;
        console.log ("json", json);
        zform.find("input[type='text'],input[type='email'],input[type='password']").each (function() { 
            var elem = $(this);
            json[elem.attr("name")] = elem.prop("value");
        });

        $.ajax ({
            type: zform.attr("method"),
            url: zform.attr("action"),
            data: json,
            dataType: "json",
            encode: true,
            success: function (data, status, xhr) {
                if (data.status === "success") {
                    if (data.redirect) {    // redirect if login good
                        window.location.assign (data.redirect);
                    } else if (data.msg) {
                        $("#msg").text(data.msg).addClass("backToBlack");
                    }
                }
                else if (data.status === "fail") {    // say which field is wrong if login bad
                    if (data.field) {
                         $("#"+data.field).siblings(".error2").css("display", "inline");
                        if (data.msg) {
                            $("#"+data.field).siblings(".error2").text(data.msg);
                        }
                    } else if (data.msg) {
                        $("#msg").text(data.msg);
                    }
                    if (data.revalidate) {
                         grecaptcha.reset();    // captcha needs revalidated on this failure
                    }
                }
            },
            error: function (jqXhr, textStatus, errorThrown) {
                console.log ("error args", arguments); // some other error chucked by php
            },
            complete: function () {
                if (doneFunc) {
                    doneFunc ();
                }
            }
        });
    }
};