var CLMSUI = CLMSUI || {};

CLMSUI.buildUserAdmin = function () {
    
    (function (original) {
        console.enableLogging = function () {
            console.log = original;
        };
        console.disableLogging = function () {
            console.log = function () {};
        };
    })(console.log);
    //console.disableLogging();
    
    var errorDateFormat = d3.time.format ("%-d-%b-%Y %H:%M:%S %Z");
    
    function constructDialogMessage (dialogID, msg, title) {
        var msgs = msg.split("<br>");
        var dialogParas = d3.select("body").append("div")
            .attr("id", dialogID)
            .attr("title", title)
            .selectAll("p").data(msgs)
        ;
        dialogParas.enter()
            .append("p")
            .html (function(d) { return d; })
        ;
    }
    
    function errorDialog (dialogID, msg, title) {
        msg = msg.concat("<A href='https://github.com/Rappsilber-Laboratory/' target='_blank'>Rappsilber Lab GitHub</A>");
        constructDialogMessage (dialogID, msg, title || "Database Error");

        $(function() { 
            $("#"+dialogID).dialog({
                modal:true,
            });
        });
    }
    
    function areYouSureDialog (dialogID, msg, title, yesFunc) {
        constructDialogMessage (dialogID, msg, title || "Confirm");

        $(function() { 
            $("#"+dialogID).dialog({
                modal:true,
                open: function () {
                    // http://stackoverflow.com/questions/1793592/jquery-ui-dialog-button-focus
                    $('.ui-dialog :button').blur();
                },
                buttons: {
                    "Proceed with Delete": function () {
                        $(this).dialog("close");
                        yesFunc();
                    },
                    "Cancel This Action": function () {
                        $(this).dialog("close");
                    }
                },
            });
        });
    }
    
    
    // Stuff that can be done before any php/database shenanigans
    function canDoImmediately () {
        // Make buttons
        var buttonData = [
            {id: "#addNewUser", type: "button"},
            {id: "#backButton", type: "button"},
        ];
        buttonData.forEach (function (buttonDatum) {
            var buttonID = buttonDatum.id;
            $(buttonID).button();  
            d3.select(buttonID).attr("type", buttonDatum.type);
        });
        
        // Add action for back button
        d3.select("#backButton").on("click", function() { window.history.back(); });
        
        // http://stackoverflow.com/questions/3519665/disable-automatic-url-detection-for-elements-with-contenteditable-flag-in-ie
        document.execCommand ("AutoUrlDetect", false, false); // This stops IE9+ auto-linking emails in contenteditable areas
    }
    canDoImmediately();
    
    
    function makeAjaxFunction (php, data, errorMsg, successFunc) {
         return function() {
             $.ajax ({
                type: data ? "POST" : "GET",
                url: php,
                data: data,
                dataType: "json",
                encode: true,
                success: function (response, textStatus, jqXhr) {
                    //console.log ("response", response, textStatus);
                    if (response.redirect) {
                        window.location.replace (response.redirect);    // redirect if server php passes this field    
                    }
                    else if (response.status == "success") {
                       successFunc (response);
                    } else {
                        errorDialog ("popErrorDialog", response.error);
                    }
                },
                error: function (jqXhr, textStatus, errorThrown) {  
                    errorDialog ("popErrorDialog", errorMsg+"<br>"+errorDateFormat (new Date()), "Connection Error");
                },
            });
         };
     }
    
    
     // Upon document being ready run this function to load in data
     $(document).ready (function () {      
         return makeAjaxFunction (
            "php/readUsers.php", 
            null, 
            "An Error occurred when trying to read the database",
            function(response) { makeTable (response.data, response.superuser); }
         )();
     });  
    
             
    function d3SelectParent (elem) {
        return d3.select (elem.parentNode);
    }

    function truthy (val) {
        return val === "t" || val === "y" || val === true;
    }
    
    function makeMapFromArray (obj, keyField) {
        return d3.map (obj, function(entry) { return entry[keyField]; });
    }

    
     function makeTable (userData, isSuperUser) {
         // Settings for tables of previous acquisitions / sequences
        $.fn.dataTable.ext.order['dom-checkbox'] = function ( settings, col ) {
            return this.api().column(col, {order:'index'}).nodes().map (function (td, i) {
                return $('input', td).prop('checked') ? '1' : '0';
            });
        };
     
        var types = {
            "id": "text", "user_name": "text", "see_all" :"checkbox", super_user: "checkbox", "email": "text", "newPassword": "text", "update": "button", "delete": "button"
        };
        var regExpPatterns = {"user_name": new RegExp (/\S{3}/i), "email": new RegExp (/\S+@\S+|^$/i), "newPassword": new RegExp (/.{7}|^$/i)};
        var typeOrder = d3.keys(types);
         
        function fillInMissingFields (row, types) {
            var fieldArray = d3.entries (types);
            fieldArray.forEach (function (field) {
                if (row[field.key] === undefined) {
                    row[field.key] = (field.value === "text") ? "" : false;
                }    
            });
        }
         
        function datumiseRow (d, types, typeOrder) {
            fillInMissingFields (d, types); 
            
            var val = d3.entries(d);
            val.forEach (function (dd) {
                if (types[dd.key] === "checkbox") {
                    dd.value = truthy (dd.value);
                }
                dd.originalValue = dd.value;
                dd.id = d.id;
            });
            
            var orderMap = makeMapFromArray (val, "key");
            return typeOrder.map (function (type) { // order the values according to typeOrder
                return orderMap.get (type);
            });
        }
         
        var tableSettings = {
            users: {domid: "#userTable", data: userData, dataIDField: "id", niceLabel: "User Table",
                    autoWidths: d3.set(["newPassword", "email"]), 
                    editable: d3.set(["newPassword", "email", "user_name"]),
                    types: types,
                    typeOrder: typeOrder
            },
        };
         
         var firstTime = true;
         d3.values(tableSettings).forEach (function (psetting) { makeIndTable (psetting); });
         //console.log ("userData", userData);
         
         
        function makeIndTable (psetting) {
            var sel = d3.select (psetting.domid);
            var baseId = psetting.domid.slice(1)+"Table";
            if (sel.select("table").empty()) {
                sel.html ("<TABLE><THEAD><TR></TR></THEAD><TBODY></TBODY></TABLE>");
                sel.select("table")
                    .attr("id", baseId)
                    .attr("class", "previousTable")
                ;
            }
            var vcWidth = Math.floor (100.0 / Math.max (1, psetting.autoWidths.size()))+"%";
            
            var hrow = sel.select("tr");
            hrow.selectAll("th").data(psetting.typeOrder).enter()
                .append("th")
                .text(function(d) { return d.replace ("_", " "); })
                .filter (function(d,i) { return psetting.autoWidths.has(d); })
                .classed ("varWidthCell", true)
                 .style ("width", vcWidth)
            ;

            var tbody = sel.select("tbody");
            var rowJoin = tbody.selectAll("tr").data(psetting.data, function(d,i) { return d[psetting.dataIDField]; });
            var newRows = rowJoin.enter().append("tr");

            var cellJoin = newRows.selectAll("td").data (function(d) { 
                return datumiseRow (d, psetting.types, psetting.typeOrder);
            });
            var newCells = cellJoin.enter().append("td");
            
            function signalContentChange (d) {
                d.value = d3.select(this).text();
                indicateValidValues (d3.select(this));
                indicateChangedValues (d3SelectParent(this));   // up to td not span element
                enableUpdateButton (d.id);
            }
            
            newCells.each (function (d, i) {
                var elemType = psetting.types[d.key];
                //console.log ("elemType", i, d.key, elemType);
                var d3Elem = d3.select(this);
                
                if (elemType === "text") {
                    d3Elem.append("span")
                        .text(function(d) { return d.value || ""; })
                        .on ("input", signalContentChange)
                        .on ("keyup", signalContentChange)
                        .on ("paste", signalContentChange)
                    ;
                }
                else if (elemType === "button") {
                    d3Elem.append("input")
                        .attr ("type", elemType)
                        .text (function(d) { return d.key; })
                        .property ("value", function(d) { return d.key; })
                        .on ("click", function (d) {  
                            // pick data from all cells in row with the right id
                            var rowSel = tbody.selectAll("tr").filter(function(dd) { return dd.id === d.id; });
                            var rowCellData = rowSel.selectAll("td").data();
                            perUserActions[d.key+"User"](rowSel, rowCellData);
                        })
                    ;
                }
                else if (elemType === "checkbox") {
                    d3Elem.append("input")
                        .attr ("type", elemType)
                        .property("checked", truthy (d.value))
                        .on ("click", function (d) {
                            d.value = !!!d.value;
                            indicateChangedValues (d3SelectParent(this));   // up to td not input element
                            enableUpdateButton (d.id);
                        })
                    ;
                }
            });
            
            // Turn update/delete buttons into JQuery-UI styled buttons
            var d3ButtonSel = newCells.selectAll("input[type='button']");
            var jqButtonSel = [].concat.apply([], d3ButtonSel);
            $(jqButtonSel).button();
            
            // disable update button in newly added rows
            newRows.each (function (d,i) { enableUpdateButton (d.id); });
            
            // set contenteditable on appropriate cells
            newCells
                .select("span")
                .filter (function(d) { return psetting.editable.has (d.key); })
                .attr ("contenteditable", "true")
            ;
            newCells
                // stuff for variable width cells, including adding tooltips
                .filter (function(d) { return psetting.autoWidths.has(d.key); })
                .classed ("varWidthCell", true)
                .style ("width", vcWidth) 
            ;

            if (firstTime) {
                $("#"+baseId).dataTable ({
                    "paging": true,
                    "jQueryUI": true,
                    "ordering": true,
                    "order": [[ 0, "desc" ]],   // order by first column
                });
                if (!isSuperUser) {
                    $("#"+baseId).DataTable().columns([2,3]).visible(false);
                }
            } else {
                // tell DataTables we have added rows (took ages to figure this out)
                var addRows = newRows.filter(function(r) { return r !== null; });   // first strip out nulls (which represent existing rows)
                var jqSel = $(addRows[0]);  // turn the d3 selection of rows into a jquery selection of rows
                $("#"+baseId).DataTable().rows.add(jqSel).draw();   // add the jquery selection using .rows()
            }
             
            firstTime = false;
        }
         
         function indicateChangedValues (sel) {
             sel = sel || d3.selectAll("table tbody").selectAll("td");
             sel.classed ("changedValue", function(d) { return d.value !== d.originalValue; });
         }
         
         function indicateValidValues (sel) {
             sel = sel || d3.selectAll("table tbody").selectAll("td");
             sel.each (function(d,i) {
                 var reg = regExpPatterns[d.key];
                 var invalid = reg && !reg.test(d.value || "");
                 d3.select(this)
                    .classed("invalid", invalid)
                 ;
             });
         }
         
         function removeRow (id) {
             var d3Sel = d3.select("#userTable tbody").selectAll("tr").filter(function(d) { return d.id === id; }).classed ("toBeRemoved", true);
             var deletedData = d3Sel.datum();
             
             var uindex = userData.map (function(user) { return user.id; }).indexOf(id);
             if (uindex >= 0) {
                userData.splice (uindex, 1);
                var row = $("#userTable table").DataTable().row(".toBeRemoved").remove().draw();
             }
             return deletedData;
         }
         
         
         var perUserActions = {
             updateUser: function (rowSel, dArray) {
                 var jsonObj = {};
                 dArray.forEach (function(d) {
                     jsonObj[d.key] = d.value;
                 });
                 
                 makeAjaxFunction (
                     "php/updateUser.php", 
                     jsonObj, 
                     "Update failed on the server before reaching the database",
                     function () { 
                        dArray.forEach (function(d) {
                            d.originalValue = d.value;
                        });
                        indicateChangedValues (rowSel.selectAll("td"));
                        enableUpdateButton (rowSel.datum().id);
                     }
                 )();
             },
             
             deleteUser: function (rowSel, dArray) {
                 var deleteUser = makeAjaxFunction (
                     "php/deleteUser.php", 
                     {id: dArray[0].id}, 
                     "Delete failed on the server before reaching the database",
                     function () { removeRow (dArray[0].id); }
                 );

                 areYouSureDialog ("popErrorDialog", "This user will be permanently deleted and cannot be restored.<br>Are You Sure?", "Please Confirm", deleteUser);
             }
         };
         
         
         function enableUpdateButton (id) {
             var d3Sel = d3.select("#userTable tbody").selectAll("tr").filter(function(d) { return d.id === id; }).selectAll("td");
             var d3Data = d3Sel.data();
             var enabled = d3Data.some (function (d3Datum) {
                 return d3Datum.originalValue != d3Datum.value;
             });
                      
             enabled = enabled && d3Data.every (function (d3Datum) {                
                 var reg = regExpPatterns[d3Datum.key];
                 return !reg || reg.test(d3Datum.value || "");
             });
             
             d3Sel.filter(function(d) { return d.key === "update"; }).selectAll("button,input").property("disabled", !enabled);
         }
         
         
         d3.select("#addNewUser")
            .on ("click", function(d) { addUser (userData); })
            .style ("display", isSuperUser ? null : "none")
         ;
         
         function addUser (userData) {
             return makeAjaxFunction (
                "php/newUser.php", 
                null, 
                "An Error occurred when trying to add a new user to the database",
                function (response) { 
                    userData.push (response.newUser);
                    makeIndTable (tableSettings.users);
                }
             )();
         }
     }
};