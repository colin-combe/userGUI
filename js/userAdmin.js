var CLMSUI = (function (mod) {
    
    mod.buildUserAdmin = function () {

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
        var spinner = new Spinner ({
            lines: 13, // The number of lines to draw
            length: 25, // The length of each line
            width: 10, // The line thickness
            radius: 35, // The radius of the inner circle
        });

        // Stuff that can be done before any php/database shenanigans
        function canDoImmediately () {

            // http://stackoverflow.com/questions/3519665/disable-automatic-url-detection-for-elements-with-contenteditable-flag-in-ie
            document.execCommand ("AutoUrlDetect", false, false); // This stops IE9+ auto-linking emails in contenteditable areas

            // add function to datatables for sorting columns of checkboxes by checked or not
            $.fn.dataTable.ext.order['dom-checkbox'] = function ( settings, col ) {
                return this.api().column(col, {order:'index'}).nodes().map (function (td) {
                    return $('input', td).prop('checked') ? '1' : '0';
                });
            };

            // add function to datatables for sorting columns of buttons by disabled or not
            $.fn.dataTable.ext.order['disabled-button'] = function ( settings, col ) {
                return this.api().column(col, {order:'index'}).nodes().map (function (td) {
                    return $('input', td).prop('disabled') ? '1' : '0';
                });
            };

            // this accommodates carat to caret spelling change in JQuery-UI 1.12.4
            var JUIClassEntries = d3.entries($.fn.dataTable.ext.oJUIClasses);
            JUIClassEntries.forEach (function (JUIClassEntry) {
                $.fn.dataTable.ext.oJUIClasses[JUIClassEntry.key] = JUIClassEntry.value.replace ("-carat-", "-caret-");
            });

        }
        canDoImmediately();


        function makeAjaxFunction (php, data, errorMsg, successFunc) {
             return function() {
                 spinner.spin (document.getElementById ("topLevel")); // need hosting element to be position relative or fixed
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
                            CLMSUI.jqdialogs.errorDialog ("popErrorDialog", response.error || errorMsg, response.error);
                        }
                    },
                    error: function (jqXhr, textStatus, errorThrown) {  
                        console.log ("error", jqXhr, textStatus, errorThrown);
                        CLMSUI.jqdialogs.errorDialog ("popErrorDialog", errorMsg+"<br>"+errorDateFormat (new Date()), getMsg("connectionErrorTitle"));
                    },
                    complete : function () {
                        spinner.stop();
                    }
                });
             };
         }

         function getMsg (key, lang) {
             return CLMSUI.msgs[lang || "en"][key];
         }


         // msg is "blah blah $1 of $2" etc
         // data is ["textfor$1", "textfor$2"] etc
         function template (msg, data) {
             return msg.replace(/(?:\$)([0-9])/g, function (rawMatch, match, token) { return data[match-1]; });
         }


         // Upon document being ready run this function to load in data
         $(document).ready (function () {      
            $.when (
                $.getJSON("./json/config.json"),
                $.getJSON("./json/msgs.json", {_: new Date().getTime() /* stops caching */ })
            ).done (function (configxhr, msgsxhr) {
                var config = configxhr[0];
                var msgs = msgsxhr[0];
                 CLMSUI.msgs = msgs;
                 //console.log ("MSGS", msgs);
                
                // Add action for back button
                d3.select("#backButton").on("click", function() { window.history.back(); });
                d3.select("#helpButton").on("click", function() { window.open (getMsg ("xiHelpURL"), "_blank"); });
                // Make buttons - previously could do immediately, but loading in text from msgs.json means icons need to be added afterwards
                var buttonData = [
                    {id: "#backButton", type: "button", icon: "ui-icon-arrowreturnthick-1-w", label: getMsg ("xiBack")},
                    {id: "#helpButton", type: "button", icon: "ui-icon-help", label: getMsg ("xiHelp")},
                ];
                buttonData.forEach (function (buttonDatum) {
                    var buttonID = buttonDatum.id;
                    d3.select(buttonID).attr ("type", buttonDatum.type);
                    $(buttonID).button ({icon: buttonDatum.icon, label: buttonDatum.label});  
                });
                
                // Having a /gi rather than just /i at the end of the regex knackers testing as the regex is reused - regex will start looking from last match rather than start
                 var emailRegexParts = splitRegex (config.emailRegex);
                CLMSUI.regExpPatterns = {/*"user_name": new RegExp (/\S{3}/i),*/ "email": new RegExp (emailRegexParts[1], emailRegexParts[2]), /*"reset_Password": new RegExp (/.{7}|^$/i)*/};

                return makeAjaxFunction (
                    "php/readUsers.php", 
                    null, 
                    getMsg ("databaseConnectError"),
                    function (response) {
                        d3.select("#username").text(response.username);
                        var buttonEnabling = {
                            filters: {
                                isSuperUser: response.superuser,
                                update: d3.set(['user_group', 'email']),
                                reset_Password: d3.set(['user_group', 'email']),
                                delete: d3.set(['delete']),
                            },
                            tests: {
                                // delete enabled if value is false
                                delete: function (dArray) { return !truthy(dArray[0].value); },
                                // password resetting allowed if valid email and user group
                                reset_Password: function (dArray) {
                                    return dArray.every (function (d) { 
                                        return isOriginalDatumValid (d, false);
                                    });    
                                },
                                // updating allowed if valie email and user group, and either is different from original value
                                update: function (dArray, isSuperUser) {
                                    // are at least some of these fields different from their original values?
                                    var enabled = dArray.some (function (d) {
                                        return !equals(d);
                                    });     
                                    // and are these new values valid?
                                    enabled &= dArray.every (function (d) { 
                                        return isDatumValid (d, isSuperUser);
                                    });
                                    return enabled;
                                },
                            }
                        };
                        var buttonLabels = {
                            delete: "delete",
                            update: "update",
                            reset_Password: "reset password"
                        };
                        makeTable (response.data, response.superuser, response.userid, response.groupTypeData, buttonLabels, buttonEnabling);
                    }
                 )();
             });
         });  

        function splitRegex (regex) {
            return regex.split("/");
        }

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

        function equals (d) {
            if ($.isArray(d.value) && $.isArray(d.originalValue)) {
                return $(d.value).not(d.originalValue).length === 0 && $(d.originalValue).not(d.value).length === 0;
            }
            return d.value === d.originalValue;
        }

        function indicateChangedValues (sel) {
            sel = sel || d3.selectAll("table tbody").selectAll("td");
            sel.classed ("changedValue", function(d) { return !equals (d); });
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

        function isDatumValid (d, isSuperUser) {
            var reg = CLMSUI.regExpPatterns[d.key];
            return !reg || reg.test(d.value || "") || (isSuperUser && !d.value);    // superusers can enter empty values
        }

        function isOriginalDatumValid (d, isSuperUser) {
            var reg = CLMSUI.regExpPatterns[d.key];
            return !reg || reg.test(d.originalValue || "") || (isSuperUser && !d.originalValue);    // superusers can enter empty values
        }

        // Enable a button dependent on a test (found in buttonEnablingLogic)
        function enableButton (id, columnName, buttonEnablingLogic) {
            var filters = buttonEnablingLogic.filters;
            var tests = buttonEnablingLogic.tests;

            // get correct row for id
            var d3Sel = d3.select("#userTable tbody").selectAll("tr").filter(function(d) { return d.id === id; }).selectAll("td");
            // filter the data for this row to just the column values to be tested
            var d3Data = d3Sel.data().filter (function(d) {
                return filters[columnName].has (d.key);
            });
            // run a test on these column values
            var enabled = tests[columnName](d3Data, filters.isSuperUser);

            d3Sel
                .filter(function(d) { return d.key === columnName; })   // filter to right button
                .selectAll("button,input")
                .property("disabled", !enabled) // if enabled returns false, set the button to be disabled
            ;
        }

        function indicateValidValues (sel, isSuperUser) {
            sel = sel || d3.selectAll("table tbody").selectAll("td");
            sel.each (function(d) {
                var invalid = !isDatumValid (d, isSuperUser);
                d3.select(this).classed("invalid", invalid);
            });
        }

        function signalContentChange (d, buttonEnablingLogic) {
            d.value = d3.select(this).text();
            indicateValidValues (d3.select(this));
            indicateChangedValues (d3SelectParent(this));   // up to td not span element
            enableButton (d.id, "update", buttonEnablingLogic);
        }

        // Used when entire row content check needs done i.e. after database update
        function signalContentChangeRow (id, buttonEnablingLogic) {
            var d3Sel = d3.select("#userTable tbody").selectAll("tr").filter(function(d) { return d.id === id; }).selectAll("td");
            setRowIndicators (id, d3Sel, buttonEnablingLogic);
        }

        function setRowIndicators (id, cellSelection, buttonEnablingLogic) {
            indicateChangedValues (cellSelection);
            enableButton (id, "update", buttonEnablingLogic);
            enableButton (id, "delete", buttonEnablingLogic);
            enableButton (id, "reset_Password", buttonEnablingLogic);
        }


        function typeCapabilities (obj) {
            var desc = [obj.name.toUpperCase().replace("_", " ")];
            if (truthy (obj.super_user)) { desc.push (getMsg ("superuser")); }
            if (truthy (obj.can_add_search)) { 
                desc.push (template (getMsg ("canAddSearches"), [d3.format(",")(obj.max_search_count)]));
            } else if (obj.can_add_search != undefined) { 
                //console.log (CLMSUI.msgs);
                desc.push (getMsg ("cannotAddSearches"));
            }
            if (truthy (obj.can_add_search) && obj.max_searches_per_day) { desc.push (template (getMsg ("searchesPerDay"), [obj.max_searches_per_day])); }
            if (truthy (obj.see_all)) { 
                desc.push (getMsg (truthy (obj.super_user) ? "canSeeAllSearches" : "canSeePublicSearches"));
            } else if (obj.see_all != undefined) {
                desc.push (getMsg ("ownSearchesOnly"));
            }
            return desc.join(", ");
        }

        function stripUnderscores (d) {
            return d.replace (/_/g, " ");
        }

        function makeMultipleSelects (tableID, oneBasedColumnIndex, optionList, buttonEnablingLogic) {
            var selectSelect = d3.select(tableID).selectAll("select");

            $(selectSelect).each (function() {
                $(this).multipleSelect({ 
                    single: true,
                    placeholder: "User Type",
                    width: 200,
                    maxHeight: "100%",
                    onClick: function (obj) {
                        var parent = obj.instance.$parent.parent()[0];  // climb up to td element
                        var origSelect = d3.select(parent).select("select");    // grab the original select element (as it has the bound data)
                        var d = origSelect.datum(); // grab the data
                        d.value = [obj.value];  // replace the data value with the new value

                        indicateChangedValues (d3.select(parent));   // up to td not input element
                        enableButton (d.id, "update", buttonEnablingLogic);
                    },
                });
            });

            // Two changes needed to get multipleSelect plug-in to work within a table:
            // 1. So drop-downs overlay surrounding rows (gets cutoff otherwise)
            d3.select(tableID).selectAll(".ms-parent").style ("position", "absolute").style("margin-top", "-1em");
            // 2. Set header of this columns min-width to current width to stop column shrinkage due to above change
            d3.select(tableID).select("thead th:nth-child("+oneBasedColumnIndex+")").style ("min-width", "200px");

            d3.selectAll(".ms-drop").selectAll("li label")
                .attr("title", function(d,i) {
                    return typeCapabilities (optionList.user_group[i]);
                })
            ;
        }


         function makeTable (userData, isSuperUser, userId, groupTypeData, labelMap, buttonEnablingLogic) {
            userData.forEach (function (userDatum) {
                userDatum.you = (userDatum.id === userId);    // mark which user is the current user
            });

            var types = {
                id: "text", you: "text", user_name: "text", user_group: "select", email: "text", update: "button", reset_Password: "button", delete: "button"
            };

            var tableSettings = {
                users: {domid: "#userTable", 
                        data: userData, 
                        dataIDField: "id",
                        autoWidths: d3.set([/*"reset_Password",*/ "email"]), 
                        editable: d3.set([/*"reset_Password",*/ "email"/*, "user_name"*/]),
                        superUserEditable: d3.set(["user_group"]),
                        columnTypes: types,
                        columnOrder: d3.keys(types),
                        columnIcons: {you : "ui-icon-person"},
                        optionLists: {user_group: groupTypeData},
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
                    .text (function(d) { return labelMap[d] || stripUnderscores(d); })    // regex needed to replace multiple "_"
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
                            .on ("input", function(d) { signalContentChange.call (this, d, buttonEnablingLogic); })
                            .on ("keyup", function(d) { signalContentChange.call (this, d, buttonEnablingLogic); })
                            .on ("paste", function(d) { signalContentChange.call (this, d, buttonEnablingLogic); })
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
                                return (labelMap[d.key] || d.key) + (d.key !== "reset_Password" ? (userId === d.id ? " Me" : " User") : ""); 
                            })
                            .on ("click", function (d) {  
                                // pick data from all cells in row with the right id
                                var rowSel = tbody.selectAll("tr").filter(function(dd) { return dd.id === d.id; });
                                var rowCellData = rowSel.selectAll("td").data();
                                perUserActions[d.key+"User"](tableSetting.data, rowCellData, tableSetting.optionLists);
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
                                enableButton (d.id, "update", buttonEnablingLogic);
                            })
                        ;
                    }
                    else if (elemType === "select") {
                        var groupVals = d.value;
                        var readOnly = !isSuperUser && tableSetting.superUserEditable.has(d.key);
                        d3Elem.append("select")
                            .property ("disabled", readOnly)
                            .attr ("title", readOnly ? getMsg ("superuserRequired") : "")
                            .selectAll("option")
                                .data(tableSetting.optionLists[d.key], function(d) { return d.id; })
                                .enter()
                                .append("option")
                                .attr ("value", function(d) { return d.id; })
                                .property ("selected", function(d) { return groupVals.indexOf (d.id) >= 0; })
                                .text (function(d) { return stripUnderscores (d.name); })
                        ;
                    }
                });

                // Turn update/delete buttons into JQuery-UI styled buttons
                var d3ButtonSel = newCells.selectAll("input[type='button']");
                var jqButtonSel = [].concat.apply([], d3ButtonSel);
                $(jqButtonSel).button();

                // For each row, existing or new, decide some states
                rowJoin.each (function (d) {
                    setRowIndicators (d.id, d3.select(this).selectAll("td"), buttonEnablingLogic);
                }); 

                newCells
                    // stuff for variable width cells, including adding tooltips
                    .filter (function(d) { return tableSetting.autoWidths.has(d.key); })
                    .classed ("varWidthCell", true)
                    .style ("width", vcWidth) 
                ;

                if (firstTime) { 
                    // Run initial DataTable setup and set various column properties
                    var selectColumns = getIndicesOf (tableSetting.columnOrder, tableSetting.columnTypes, [], ["select"]);
                    makeMultipleSelects ("#"+baseId, selectColumns[0] + 1, tableSetting.optionLists, buttonEnablingLogic);

                    var checkboxColumns = getIndicesOf (tableSetting.columnOrder, tableSetting.columnTypes, [], ["checkbox"]);
                    var updateUserColumns = getIndicesOf (tableSetting.columnOrder, tableSetting.columnTypes, ["update"], []);
                    var unsortableColumns = !isSuperUser ? d3.range (0, tableSetting.columnOrder.length)
                        : getIndicesOf (tableSetting.columnOrder, tableSetting.columnTypes, ["reset_Password", "delete"], [])
                    ;
                    $("#"+baseId).dataTable ({
                        "paging": true,
                        "jQueryUI": true,
                        "ordering": true,
                        "order": [[ 0, "desc" ]],   // order by first column
                        "columnDefs": [
                            {"orderDataType": "dom-checkbox", "targets": checkboxColumns},   // 2nd and 3rd columns will be sorted by checkbox value
                            {"orderDataType": "disabled-button", "targets": updateUserColumns},   // this column will be sorted by disabled property value
                            {"orderable": false, "targets": unsortableColumns}, // These columns shouldn't be sortable (all same value)
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
                    var superuserOnlyColumns = getIndicesOf (tableSetting.columnOrder, tableSetting.columnTypes, ["id", "super_user", "you"], []);
                    // best to hide columns user has no privilege to change - http://stackoverflow.com/a/372503/368214
                    $("#"+baseId).DataTable().columns(superuserOnlyColumns).visible(false);

                    // Except where we want it to communicate a state
                    var superuserOnlyColumns2 = getIndicesOf (tableSetting.columnOrder, tableSetting.columnTypes, tableSetting.superUserEditable.values(), []);
                    $("#"+baseId).DataTable().columns(superuserOnlyColumns2).nodes().flatten().to$().addClass("readOnly");
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

             // Beware
             function areYouRemovingOwnSuperuserStatus (isSuperUser, jsonObj, optionLists) {
                 //var danger = (isSuperUser && jsonObj.super_user === false && jsonObj.id === userId);
                 var danger = (isSuperUser && jsonObj.id === userId);
                 if (danger) {
                     var set = d3.set (jsonObj.user_group);
                     var appropGroups = optionLists.user_group.filter (function (userGroup) {
                        return set.has (userGroup.id);
                     });
                     danger &= !(appropGroups.some (function (group) {
                        return truthy (group.super_user);  
                     }));
                 }
                 return danger;
             }


             var perUserActions = {
                 updateUser: function (udata, dArray, optionLists) {    // userdata should be arg for safety sake
                     var jsonObj = {id: udata[0].id};   // overwritten by actual user id if superuser
                     dArray.forEach (function(d) {
                         jsonObj[d.key] = d.value;
                     });
                     var removingOwnSuperuserStatus = areYouRemovingOwnSuperuserStatus (isSuperUser, jsonObj, optionLists);

                     var updateUserAjax = makeAjaxFunction (
                         "php/updateUser.php", 
                         jsonObj, 
                         getMsg("userDatabaseUpdateCatchall"),
                         function () { 
                             //console.log ("updated obj", jsonObj);
                            dArray.forEach (function(d) {
                                d.originalValue = d.value;
                            });
                            if (removingOwnSuperuserStatus) {
                                // This is easier than trying to persude DataTables to reveal the original rows in the table and remove them
                                location.reload();
                                /*
                                isSuperUser = false;
                                var otherUserIDs = udata
                                    .map(function(uDatum) { return uDatum.id; })
                                    .filter(function(uid) { return uid !== userId; })
                                ;
                                removeRows (otherUserIDs, udata);
                                */
                            } else {
                                signalContentChangeRow (dArray[0].id, buttonEnablingLogic);
                                 //makeIndTable (tableSettings.users);
                            }
                         }
                     );
                     if (removingOwnSuperuserStatus) {
                         CLMSUI.jqdialogs.areYouSureDialog ("popErrorDialog", getMsg("clientRevokeSuperuser"), getMsg("pleaseConfirm"), getMsg("proceedUpdate"), getMsg("cancel"), updateUserAjax);
                     } else {
                        updateUserAjax();
                     }
                 },

                 deleteUser: function (udata, dArray) {
                     var deletingID = dArray[0].id;
                     var selfDelete = deletingID == userId;

                     var deleteUserAjax = makeAjaxFunction (
                         "php/deleteUser.php", 
                         {id: deletingID}, 
                         getMsg ("deleteCatchallError"),
                         function () { 
                            var deleteDatum = dArray.filter (function(d) { return d.key === "delete"; })[0];
                            deleteDatum.value = true;
                            deleteDatum.originalValue = true;
                            var emailDatum = dArray.filter (function(d) { return d.key === "email"; })[0];
                            //emailDatum.value = "";
                            emailDatum.originalValue = "";
                            selfDelete ? window.location.replace ("./php/logout.php") : signalContentChangeRow (deletingID, buttonEnablingLogic);
                            // signalContentChange was previously removeRows ([deletingID], udata)
                         }
                     );

                     CLMSUI.jqdialogs.areYouSureDialog ("popErrorDialog", getMsg(selfDelete ? "clientDeleteYourself" : "clientDeleteUser"), getMsg("pleaseConfirm"), getMsg("proceedDelete"), getMsg("cancel"), deleteUserAjax);
                 },

                 reset_PasswordUser: function (udata, dArray) {
                     var resetPasswordAjax = makeAjaxFunction (
                         "php/resetPasswordUser.php", 
                         {id: dArray[0].id}, 
                         getMsg ("emailInvalid"),
                         function () {}
                     );

                     CLMSUI.jqdialogs.areYouSureDialog ("popErrorDialog", getMsg("clientResetPassword"), getMsg("pleaseConfirm"), getMsg("proceedEmail"), getMsg("cancel"), resetPasswordAjax);
                 },
             };

         }
    };
    
    return mod;
    
}(CLMSUI || {}));