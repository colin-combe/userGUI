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
    
    // Stuff that can be done before any php/database shenanigans
    function canDoImmediately () {
        // Make buttons
        var buttonData = [
            {id: "#backButton", type: "button"},
        ];
        buttonData.forEach (function (buttonDatum) {
            var buttonID = buttonDatum.id;
            d3.select(buttonID).attr("type", buttonDatum.type);
            $(buttonID).button();  
        });
        
        // Add action for back button
        d3.select("#backButton").on("click", function() { window.history.back(); });
        
        // http://stackoverflow.com/questions/3519665/disable-automatic-url-detection-for-elements-with-contenteditable-flag-in-ie
        document.execCommand ("AutoUrlDetect", false, false); // This stops IE9+ auto-linking emails in contenteditable areas
        
        // add function to datatables for sorting columns of checkboxes
        $.fn.dataTable.ext.order['dom-checkbox'] = function ( settings, col ) {
            return this.api().column(col, {order:'index'}).nodes().map (function (td) {
                return $('input', td).prop('checked') ? '1' : '0';
            });
        };
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
                    console.log ("response", response, textStatus);
                    if (response.redirect) {
                        window.location.replace (response.redirect);    // redirect if server php passes this field    
                    }
                    else if (response.status == "success") {
                       successFunc (response);
                    } else {
                        CLMSUI.jqdialogs.errorDialog ("popErrorDialog", response.error);
                    }
                },
                error: function (jqXhr, textStatus, errorThrown) {  
                    CLMSUI.jqdialogs.errorDialog ("popErrorDialog", errorMsg+"<br>"+errorDateFormat (new Date()), "Connection Error");
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
            function(response) { makeTable (response.data, response.superuser, response.userid); }
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
    
    function getIndicesOf (typeOrder, types, keys, values) {
        var indices = [];
        typeOrder.forEach (function (type, i) {
            if ((keys && keys.indexOf(type) >= 0) || (values && values.indexOf (types[type]) >= 0)) {
                indices.push(i);
            }
        });
        return indices;
    }
    
    var regExpPatterns = {/*"user_name": new RegExp (/\S{3}/i),*/ "email": new RegExp (/\S+@\S+|^$/i), /*"reset_Password": new RegExp (/.{7}|^$/i)*/};
    
    function indicateChangedValues (sel) {
        sel = sel || d3.selectAll("table tbody").selectAll("td");
        sel.classed ("changedValue", function(d) { return d.value !== d.originalValue; });
    }
    
    function fillInMissingFields (row, types) {
        var fieldArray = d3.entries (types);
            fieldArray.forEach (function (field) {
            if (row[field.key] === undefined || row[field.key] === null) {
                row[field.key] = (field.value === "text") ? "" : false;
            }    
        });
    }
    
    // turn obj into ordered array of key/value/id/originalValue values
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
    
    function isDatumValid (d) {
        var reg = regExpPatterns[d.key];
        return !reg || reg.test(d.value || "");
    }
    
    function enableUpdateButton (id) {
        var d3Sel = d3.select("#userTable tbody").selectAll("tr").filter(function(d) { return d.id === id; }).selectAll("td");
        var d3Data = d3Sel.data();
        var enabled = d3Data.some (function (d3Datum) {
            return d3Datum.originalValue != d3Datum.value;
        });

        enabled = enabled && d3Data.every (function (d3Datum) {                
            return isDatumValid (d3Datum);
        });

        d3Sel.filter(function(d) { return d.key === "update"; }).selectAll("button,input").property("disabled", !enabled);
    }
    
    function indicateValidValues (sel) {
        sel = sel || d3.selectAll("table tbody").selectAll("td");
        sel.each (function(d) {
            var invalid = !isDatumValid (d);
            d3.select(this).classed("invalid", invalid);
        });
    }
    
    function signalContentChange (d) {
        d.value = d3.select(this).text();
        indicateValidValues (d3.select(this));
        indicateChangedValues (d3SelectParent(this));   // up to td not span element
        enableUpdateButton (d.id);
    }

    
     function makeTable (userData, isSuperUser, userId) {
        userData.forEach (function (userDatum) {
            userDatum.you = (userDatum.id === userId);    // mark which user is the current user
        });
     
        var types = {
            id: "text", you: "text", user_name: "text", see_all: "checkbox", can_add_search: "checkbox", super_user: "checkbox", email: "text", update: "button", reset_Password: "button", delete: "button"
        };
         
        var tableSettings = {
            users: {domid: "#userTable", 
                    data: userData, 
                    dataIDField: "id",
                    autoWidths: d3.set([/*"reset_Password",*/ "email"]), 
                    editable: d3.set([/*"reset_Password",*/ "email"/*, "user_name"*/]),
                    columnTypes: types,
                    columnOrder:  d3.keys(types),
                    columnIcons: {you : "ui-icon-person"}
            },
        };
         
        d3.values(tableSettings).forEach (function (tableSetting) { makeIndTable (tableSetting); });
         
        function makeIndTable (tableSetting) {
            var sel = d3.select (tableSetting.domid);
            var baseId = tableSetting.domid.slice(1)+"Table";
            if (sel.select("table").empty()) {
                sel.html ("<TABLE><THEAD><TR></TR></THEAD><TBODY></TBODY></TABLE>");
                sel.select("table")
                    .attr("id", baseId)
                    .attr("class", "previousTable")
                ;
            }
            
            // has dataTable class already been initialized on this table?
            var firstTime = !sel.select("table").classed("dataTable");   
            var vcWidth = Math.floor (100.0 / Math.max (1, tableSetting.autoWidths.size()))+"%";
            
            var hrow = sel.select("tr");    // Make column header row
            if (!firstTime) {
                // DataTables visible() seems to entirely remove columns from a table rather than just css them out of view
                // so need to make visible hidden columns or .enter will add in new columns we don't want
                $("#"+baseId).DataTable().columns().visible(true);  
            }
            hrow.selectAll("th").data(tableSetting.columnOrder)
                .enter()
                .append("th")
                .text(function(d) { return d.replace (/_/g, " "); })    // regex needed to replace multiple "_"
                .filter (function(d) { return tableSetting.autoWidths.has(d); })
                .classed ("varWidthCell", true)
                 .style ("width", vcWidth)
            ;

            var tbody = sel.select("tbody");
            console.log ("tab", tableSetting.data, tbody.selectAll("tr"));
            var rowJoin = tbody.selectAll("tr").data(tableSetting.data, function(d) { return d[tableSetting.dataIDField]; });
            var newRows = rowJoin.enter().append("tr");
            console.log ("newRows", newRows, rowJoin.exit());

            var cellJoin = newRows.selectAll("td").data (function(d) { 
                return datumiseRow (d, tableSetting.columnTypes, tableSetting.columnOrder);
            });
            var newCells = cellJoin.enter().append("td");
            

            
            newCells.each (function (d) {
                var elemType = tableSetting.columnTypes[d.key];
                var d3Elem = d3.select(this);
                
                if (elemType === "text") {
                    var span = d3Elem.append("span")
                        .text(function(d) { return d.value || ""; })
                        .on ("input", signalContentChange)
                        .on ("keyup", signalContentChange)
                        .on ("paste", signalContentChange)
                        .attr ("contenteditable", tableSetting.editable.has(d.key))
                    ;
                    if (tableSetting.columnIcons[d.key]) {
                        span.classed("ui-icon "+tableSetting.columnIcons[d.key], d.value);
                    }
                }
                else if (elemType === "button") {
                    d3Elem.append("input")
                        .attr ("type", elemType)
                        //.text (function(d) { return d.key+" User"; })
                        .property ("value", function(d) {
                            return d.key.replace (/_/g, " ") + (d.key === "update" || d.key === "delete" ? (userId === d.id ? " Me" : " User") : ""); 
                        })
                        .on ("click", function (d) {  
                            // pick data from all cells in row with the right id
                            var rowSel = tbody.selectAll("tr").filter(function(dd) { return dd.id === d.id; });
                            var rowCellData = rowSel.selectAll("td").data();
                            perUserActions[d.key+"User"](tableSetting.data, rowCellData);
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
                  
            // For each row, existing or new, decide some states
            rowJoin.each (function (d) {
                enableUpdateButton (d.id);  // decide update button state
                indicateChangedValues (d3.select(this).selectAll("td"));    // show if cell values have been altered from original
            }); 
            
            newCells
                // stuff for variable width cells, including adding tooltips
                .filter (function(d) { return tableSetting.autoWidths.has(d.key); })
                .classed ("varWidthCell", true)
                .style ("width", vcWidth) 
            ;

            if (firstTime) {
                var checkboxColumns = getIndicesOf (tableSetting.columnOrder, tableSetting.columnTypes, [], ["checkbox"]);
                $("#"+baseId).dataTable ({
                    "paging": true,
                    "jQueryUI": true,
                    "ordering": true,
                    "order": [[ 0, "desc" ]],   // order by first column
                    "columnDefs": [
                        {"orderDataType": "dom-checkbox", "targets": checkboxColumns},   // 2nd and 3rd columns will be sorted by checkbox value
                    ]
                });
            } else {
                // how to tell DataTables we have added rows (took ages to figure this out)
                // update 05/12/16; actually, adding adds every row not on the current page again :-(
                // good job i don't really need to add anything to the table anymore, just delete the odd user
                // var addRows = newRows.filter(function(r) { return r !== null; });   // first strip out nulls (which represent existing rows)
                // var jqSel = $(addRows[0]);  // turn the d3 selection of rows into a jquery selection of rows
                // $("#"+baseId).DataTable().rows.add(jqSel).draw();   // add the jquery selection using .rows()
                
                // how to tell DataTables we have removed rows (this was easier)
                rowJoin.exit().classed ("toBeRemoved", true);
                $("#"+baseId).DataTable().rows(".toBeRemoved").remove().draw();
                rowJoin.exit().remove();
            }
            if (!isSuperUser) {
                var superuserOnlyColumns = getIndicesOf (tableSetting.columnOrder, tableSetting.columnTypes, ["id", "see_all", "can_add_search", "super_user", "you"], []);
                // best to hide columns user has no privilege to change - http://stackoverflow.com/a/372503/368214
                $("#"+baseId).DataTable().columns(superuserOnlyColumns).visible(false);
            }
            
            // highlight user's own row, do after datatable 'cos it wipes out existing classes
            newRows.classed ("isUser", function(d) { return isSuperUser && d.id === userId; }); 
        }
         
         function removeRows (ids, udata) {
             udata = udata.filter (function (uDatum) {
                return ids.indexOf (uDatum.id) < 0; 
             });
             tableSettings.users.data = udata;
             makeIndTable (tableSettings.users);
         }
         
         
         var perUserActions = {
             updateUser: function (udata, dArray) {    // userdata should be arg for safety sake
                 var jsonObj = {};
                 dArray.forEach (function(d) {
                     jsonObj[d.key] = d.value;
                 });
                 var removingOwnSuperuserStatus = (isSuperUser && jsonObj.super_user === false && jsonObj.id === userId);
                 
                 var updateUserAjax = makeAjaxFunction (
                     "php/updateUser.php", 
                     jsonObj, 
                     "Update failed on the server before reaching the database",
                     function () { 
                         console.log ("updated obj", jsonObj);
                        dArray.forEach (function(d) {
                            d.originalValue = d.value;
                        });
                        if (removingOwnSuperuserStatus) {
                            isSuperUser = false;
                            var otherUserIDs = udata
                                .map(function(uDatum) { return uDatum.id; })
                                .filter(function(uid) { return uid !== userId; })
                            ;
                            removeRows (otherUserIDs, udata);
                        } else {
                             makeIndTable (tableSettings.users);
                        }
                     }
                 );
                 if (removingOwnSuperuserStatus) {
                     CLMSUI.jqdialogs.areYouSureDialog ("popErrorDialog", "Removing your own superuser status cannot be undone (by yourself).<br>Are You Sure?", "Please Confirm", "Proceed with Update", "Cancel this Action", updateUserAjax);
                 } else {
                    updateUserAjax();
                 }
             },
             
             deleteUser: function (udata, dArray) {
                 var deleteUserAjax = makeAjaxFunction (
                     "php/deleteUser.php", 
                     {id: dArray[0].id}, 
                     "Delete failed on the server before reaching the database",
                     function () { removeRows ([dArray[0].id], udata); }
                 );

                 CLMSUI.jqdialogs.areYouSureDialog ("popErrorDialog", "This user will be permanently deleted and cannot be restored.<br>Are You Sure?", "Please Confirm", "Proceed with Delete", "Cancel this Action", deleteUserAjax);
             },
             
             reset_PasswordUser: function (udata, dArray) {
                 console.log ("uddd", udata, dArray);
                 var resetPasswordAjax = makeAjaxFunction (
                     "php/resetPasswordUser.php", 
                     {id: dArray[0].id}, 
                     "Email notification failure, check email address is valid",
                     function () {}
                 );

                 CLMSUI.jqdialogs.areYouSureDialog ("popErrorDialog", "This will send a link to the user's email to reset their password.<br>Are You Sure?", "Please Confirm", "Proceed with Email", "Cancel this Action", resetPasswordAjax);
             },
         };
         
     }
};