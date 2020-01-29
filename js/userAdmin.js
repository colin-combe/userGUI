var CLMSUI = (function (mod) {

    /**
    * Javascript code for constructing a paged table of xi users
    * from a returned database query, along with actions to perform
    * on those users.
    * @version 1.0
    * @namespace CLMSUI.buildUserAdmin
    */
    mod.buildUserAdmin = function () {

        // enable / disable console log
        (function (original) {
            console.enableLogging = function () {
                console.log = original;
            };
            console.disableLogging = function () {
                console.log = function () {};
            };
        })(console.log);
        console.disableLogging();

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
        }
        canDoImmediately();


        /**
        * Factory function that returns an function to start an ajax request
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param php - the php script to run
        * @param data - the data to POST to the php function - leave null for a GET request
        * @param errorMsg - a default error message to display if things go wrong
        * @param successFunc - callback to run if a result is returned
        * @returns a function that includes an ajax call set up with the given parameters
        */
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
                        if (response.times) {
                            response.times.io = ((new Date).getTime() / 1000) - response.times.endAbsolute;
                        }
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

        /**
        * Loops through an array of objects, and fills in undefined properties in place with default values
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param data - array of javascript objects
        * @param defaults - object of default key/values e.g. name: "unknown", species: "cat"
        */
        function fillInMissingFields (data, defaults) {
            var defaultEntries = d3.entries (defaults);
            data.forEach (function (userDatum) {
                defaultEntries.forEach (function (rentry) {
                    var userVal = userDatum[rentry.key];
                    if (userVal === undefined || userVal === null) {
                        userDatum[rentry.key] = rentry.value;
                    }
                })
            });
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

                // Make buttons - previously could do immediately, but loading in text from msgs.json means icons need to be added afterwards
                var buttonData = [
                    {id: "#backButton", type: "button", icon: "ui-icon-arrowreturnthick-1-w", label: getMsg ("xiBack"), func: function() { window.history.back(); }},
                    {id: "#helpButton", type: "button", icon: "ui-icon-help", label: getMsg ("xiHelp"), func: function() { window.open (getMsg ("xiHelpURL"), "_blank"); }},
                    {id: "#logoutButton", type: "button", icon: "ui-icon-extlink", label: getMsg ("xiLogout"), func: function () { window.location.href = getMsg ("xiLogoutURL"); }},
                ];
                buttonData.forEach (function (buttonDatum) {
                    var buttonID = buttonDatum.id;
                    d3.select(buttonID)
                        .attr ("type", buttonDatum.type)
                        .on ("click", buttonDatum.func)
                    ;
                    $(buttonID).button ({icon: buttonDatum.icon, label: buttonDatum.label});
                });

                // Having a /gi rather than just /i at the end of the regex knackers testing as the regex is reused - regex will start looking from last match rather than start
                 var emailRegexParts = splitRegex (config.emailRegex);
                CLMSUI.regExpPatterns = {/*"user_name": new RegExp (/\S{3}/i),*/ "email": new RegExp (emailRegexParts[1], emailRegexParts[2]), /*"reset_Password": new RegExp (/.{7}|^$/i)*/};

                // Load in user data from database and make a d3table from it
                return makeAjaxFunction (
                    "php/readUsers.php",
                    null,
                    getMsg ("databaseConnectError"),
                    function (response) {
                        d3.select("#username").text(response.username);
                        fillInMissingFields (response.data, {email: "", delete: false});
                        var buttonEnabling = {
                            filters: {
                                isSuperUser: response.superuser,
                                update: d3.set(['user_group', 'email']),
                                reset_Password: d3.set(['user_group', 'email']),
                                delete: d3.set(['delete']),
                            },
                            tests: {
                                // delete enabled if value is false
                                delete: function (dArray) { return !truthy(dArray[0].value[dArray[0].key]); },
                                // password resetting allowed if valid email and user group
                                reset_Password: function (dArray) {
                                    return dArray.every (function (d) {
                                        return isOriginalDatumValid (d, false);
                                    });
                                },
                                // updating allowed if valid email and user group, and either is different from original value
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

                        makeTable (response.data, response.superuser, response.userid, response.groupTypeData, buttonEnabling);
                    }
                 )();
             });
         });


        function splitRegex (regex) {
            return regex.split("/");
        }

        /**
        * Return the parent of a DOM element as a D3 selection
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param elem - the DOM element
        * @returns the parent node as a d3 selection
        */
        function d3SelectParent (elem) {
            return d3.select (elem.parentNode);
        }

        /**
        * Filter the user table to a single row by matching the passed id to the row's data id
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param rowID - ID of the row to match
        * @returns the matched row as a single d3 selection
        */
        function selectRowByID (rowID) {
            return d3.select("#userTable tbody").selectAll("tr").filter(function(d) { return d.id === rowID; })
        }

        function truthy (val) {
            return val === "t" || val === "y" || val === true;
        }


        /**
        * Tests if an objects value for a given key is the same as the original value. The object has the properties key and value.
        * Within value are properties indexed by key. Value also has an originalData property with nested properties also indexed by key. These are compared.
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param d - the data object.
        * @returns true or false if the value matches the original version
        */
        function equals (d) {
            var dv = d.value[d.key];
            var dov = d.value.originalData[d.key];
            if ($.isArray(dv) && $.isArray(dov)) {
                return $(dv).not(dov).length === 0 && $(dov).not(dv).length === 0;
            }
            return dv === dov;
        }

        /**
        * Tests a datum against a pre-defined regular expression pattern for validity.
        * The datum has the fields key and value. The regex is obtained from CLMSUI.regExpPatterns by the key.
        * The datum's value object is then searched for a property indexed by key. This is then tested against the regex.
        * Superusers can validate null values.
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param d - the data object.
        * @param isSuperUser - is current user a superuser
        * @returns true or false if the value validates
        */
        function isDatumValid (d, isSuperUser) {
            var reg = CLMSUI.regExpPatterns[d.key];
            return !reg || reg.test(d.value[d.key] || "") || (isSuperUser && !d.value[d.key]);    // superusers can enter empty values
        }

        /**
        * The same as isDatumValid but for the original values of the datum.
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param d - the data object.
        * @param isSuperUser - is current user a superuser
        * @returns true or false if the value validates
        */
        function isOriginalDatumValid (d, isSuperUser) {
            var reg = CLMSUI.regExpPatterns[d.key];
            return !reg || reg.test(d.value.originalData[d.key] || "") || (isSuperUser && !d.value.originalData[d.key]);    // superusers can enter empty values
        }

        /**
        * Enable a button dependent on a test (found in buttonEnablingLogic).
        * The buttonEnablingLogic has two properties - tests and filters - which in turn are objects holding sets or functions keyed by column name.
        * The filters property (keyed by column name) holds sets that list which other columns need to have valid values for this column's button to be enabled.
        * The tests functions use the contents of a given cell (rowData / columnName as key) to test for validity.
        * So if all the filter columns for a given column pass their respective tests then a button in that given column is enabled.
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param rowData - the data object for a particular table row.
        * @param columnName - the name of the column the button or input widget is in.
        * @param buttonEnablingLogic - object with tests and filters properties that decide the logic for button enabling
        */
        function enableButton (rowData, columnName, buttonEnablingLogic) {
            var filters = buttonEnablingLogic.filters;
            var tests = buttonEnablingLogic.tests;

            // get correct row for id
            var d3Sel = selectRowByID(rowData.id).selectAll("td");
            var cellData = d3Sel.data();

            var testData = cellData.filter (function(d) { return filters[columnName].has (d.key); });
            // run a test on these column values
            var enabled = tests[columnName](testData, filters.isSuperUser);

            d3Sel
                .filter(function(d) { return d.key === columnName; })   // filter to right button
                .selectAll("button,input")
                .property("disabled", !enabled) // if enabled returns false, set the button to be disabled
            ;
        }

        /**
        * Pass the data object(s) within a d3 selection to isDatumValid and style the corresponding DOM elements as valid/invalid
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param sel - d3 selection. Will be the d3 selection of all table cells if null.
        */
        function indicateValidValues (sel, isSuperUser) {
            sel = sel || d3.selectAll("table tbody").selectAll("td");
            sel.classed ("invalid", function(d) { return !isDatumValid (d, isSuperUser); });
        }

        /**
        * Pass the data object(s) within a d3 selection to equals and style the corresponding DOM elements as having a changedValue or not
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param sel - d3 selection. Will be the d3 selection of all table cells if null.
        */
        function indicateChangedValues (sel) {
            sel = sel || d3.selectAll("table tbody").selectAll("td");
            sel.classed ("changedValue", function(d) { return !equals (d); });
        }

        /**
        * For a single table cell d3 selection, store the DOM element's text content as the new data value for the datum's key (d.value[d.key] = text; )
        * Then reset visual valid / change / button enabling states.
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param singleCellSel - single table cell d3 selection.
        * @param buttonEnablingLogic - object with tests and filters properties that decide the logic for button enabling
        */
        function signalContentChangeCell (singleCellSel, buttonEnablingLogic) {
            var d = singleCellSel.datum();
            d.value[d.key] = singleCellSel.text();
            indicateValidValues (singleCellSel);
            indicateChangedValues (d3SelectParent(singleCellSel.node()));   // up to td not span element
            enableButton (d.value, "update", buttonEnablingLogic);
        }

        /**
        * Indicate changed value states for a whole table row (passed in as a d3 selection) and also recalculate that row's button enabled states
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param singleRowSelection - d3 selection of a single table row.
        * @param buttonEnablingLogic - object with tests and filters properties that decide the logic for button enabling
        */
        function setRowIndicators (singleRowSelection, buttonEnablingLogic) {
            //console.error ("sri", singleRowSelection, singleRowSelection.selectAll("td"));
            indicateChangedValues (singleRowSelection.selectAll("td"));
            var d = singleRowSelection.datum();
            enableButton (d, "update", buttonEnablingLogic);
            enableButton (d, "delete", buttonEnablingLogic);
            enableButton (d, "reset_Password", buttonEnablingLogic);
        }

        /**
        * Indicate changed value states for a whole table row (by id) and also recalculate that row's button enabled states
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param singleRowSelection - id of a single table row.
        * @param buttonEnablingLogic - object with tests and filters properties that decide the logic for button enabling
        */
        function signalContentChangeRow (id, buttonEnablingLogic) {
            setRowIndicators (selectRowByID (id), buttonEnablingLogic);
        }

        /**
        * Make user group tooltip text for dropdown selections
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param userGroup - userGroup with properties taken from DB
        * @returns relevant tooltip text decided by userGroup properties
        */
        function userGroupCapabilities (userGroup) {
            var desc = [userGroup.name.toUpperCase().replace("_", " ")];
            if (truthy (userGroup.super_user)) { desc.push (getMsg ("superuser")); }
            if (truthy (userGroup.can_add_search)) {
                desc.push (template (getMsg ("canAddSearches"), [d3.format(",")(userGroup.max_search_count)]));
            } else if (userGroup.can_add_search != undefined) {
                //console.log (CLMSUI.msgs);
                desc.push (getMsg ("cannotAddSearches"));
            }
            if (truthy (userGroup.can_add_search) && userGroup.max_searches_per_day) { desc.push (template (getMsg ("searchesPerDay"), [userGroup.max_searches_per_day])); }
            if (truthy (userGroup.see_all)) {
                desc.push (getMsg (truthy (userGroup.super_user) ? "canSeeAllSearches" : "canSeePublicSearches"));
            } else if (userGroup.see_all != undefined) {
                desc.push (getMsg ("ownSearchesOnly"));
            }
            return desc.join(". ");
        }

        function stripUnderscores (d) {
            return d.replace (/_/g, " ");
        }


        /**
        * Main make table routine
        * Constructs a d3table using the userData. Stylings for the table and hooks for actions such as buttons/inputs are also added.
        * Multiple select widgets are added to the user group column.
        * @function
        * @inner
        * @memberof CLMSUI.buildUserAdmin
        * @param userData - user data as returned from DB
        * @param isSuperUser - is current user a superuser?
        * @param userId - id of current user
        * @param groupTypeData - userGroup data as returned from DB
        * @param buttonEnablingLogic - object with tests and filters properties that decide the logic for button enabling
        * @returns relevant tooltip text decided by userGroup properties
        */
         function makeTable (userData, isSuperUser, userId, groupTypeData, buttonEnablingLogic) {
            userData.forEach (function (userDatum) {
                userDatum.you = (userDatum.id === userId);    // mark which user is the current user
                userDatum.originalData = $.extend({}, userDatum);
            });

             // for sorting / filtering column of user groups (technically, it can have multiple values)
            var alphaArrayTypeSettingsFactory = function (labelMap) {
                return {
                    preprocessFunc: function (filterVal) {
                        return this.typeSettings("alpha").preprocessFunc (filterVal);
                    },
                    filterFunc: function (datum, processedFilterVal) {
                        var basicFilterFunc = this.typeSettings("alpha").filterFunc;
                        var pass = false;
                        if (Array.isArray(datum)) {
                            // just need 1 element in array to not be filtered out to pass
                            for (var m = 0; m < datum.length; m++) {
                                if (basicFilterFunc (labelMap[datum[m]], processedFilterVal)) {
                                    pass = true;
                                    break;
                                }
                            }
                        } else {
                            pass = basicFilterFunc (labelMap[datum], processedFilterVal);
                        }
                        return pass;
                    },
                    comparator: function (a, b) {
                        var comparator = this.typeSettings("alpha").comparator;
                        var minlen = Math.min (a.length, b.length);
                        for (var n = 0; n < minlen; n++) {
                            var diff = comparator (labelMap[a[n]], labelMap[b[n]]);
                            if (diff !== 0) {
                                return diff;
                            }
                        }

                        var z = a.length - b.length;
                        return z;
                    }
                };
            };
             var groupLabelMap = {};
             groupTypeData.forEach (function (group) {
                 groupLabelMap[group.id] = group.name;
             })
             var alphaArrayTypeSettings = alphaArrayTypeSettingsFactory (groupLabelMap);


            function highlightRows (rowSel) {
                rowSel.classed ("isUser", function(d) { return isSuperUser && d.id === userId; });
            }

             function enableCells (rowSel) {
                 rowSel.each (function () { setRowIndicators (d3.select(this), buttonEnablingLogic); })
             }

             // Columns for d3 table
             var columnSettings = {
                id: {columnName: "ID", type: "numeric", headerTooltip: "", visible: isSuperUser, removable: true},
                you: {columnName: "You", type: "boolean", headerTooltip: "", visible: isSuperUser, removable: true},
                user_name: {columnName: "User Name", type: "alpha", headerTooltip: "", visible: true, removable: false},
                user_group: {columnName: "User Group", type: "alphaArray", headerTooltip: "", visible: true, removable: false, cellStyle: "fitMultipleSelect"},
                email: {columnName: "Email", type: "alpha", headerTooltip: "", visible: true, removable: false},
                update: {columnName: "Update", type: "boolean", headerTooltip: "", visible: true, removable: false},
                reset_Password: {columnName: "Reset Password", type: "none", headerTooltip: "", visible: true, removable: false},
                delete: {columnName: "Delete", type: "none", headerTooltip: "", visible: true, removable: true},
            };

             // hook that calls functions in perUserActions
             var buttonHook = function (sel) {
                var but = sel.select("button");
                but.on ("click", function (d) {
                    perUserActions[d.key+"User"](d.value, {userGroup: groupTypeData});
                 });
                 $(but).button()
                 but.each (function (d,i) {
                     $(this).button(truthy(d.value[d.key]) ? "disable" : "enable");
                 });
            };


            var tableSettings = {
                users: {domid: "#userTable",
                    data: userData,
                    columnSettings: columnSettings,
                    modifiers: {
                        you: function (d) { return d.you ? "<span class='ui-icon ui-icon-person'></span>" : ""; },
                        user_group: function () { return "<select></select>"; },
                        email: function (d) { return "<span>"+d.email+"</span><span class='ui-icon ui-icon-pencil'></span>"; },
                        update: function () { return "<button>Update</button>"; },
                        reset_Password: function () { return "<button>Reset Password</button>"; },
                        delete: function (d) { return "<button>Delete "+(userId === d.id ? " Me" : " User")+"</button>"; },
                    },
                    autoWidths: d3.set(["email"]),
                    cellD3Hooks: {
                        user_group: function (cellSel) {
                            var d = cellSel.datum();
                            var groupVals = d.value[d.key];
                            var readOnly = !isSuperUser;
                            cellSel.select("select")
                                .property ("disabled", readOnly)
                                .attr ("title", readOnly ? getMsg ("superuserRequired") : "")
                                .selectAll("option")
                                    .data (groupTypeData, function(d) { return d.id; })
                                    .enter()
                                    .append("option")
                                    .attr ("value", function(d) { return d.id; })
                                    .property ("selected", function(d) { return groupVals.indexOf (d.id) >= 0; })
                                    .text (function(d) { return stripUnderscores (d.name); })
                            ;

                            $(cellSel.select("select")).multipleSelect({
                                single: true,
                                placeholder: "User Type",
                                width: 200,
                                maxHeight: "100%",
                                onClick: function (obj) {
                                    d.value[d.key] = [obj.value];  // replace the data value with the new value
                                    indicateChangedValues (cellSel);   // up to td parent element
                                    enableButton (d.value, "update", buttonEnablingLogic);
                                },
                            });

                            cellSel.select(".ms-drop").selectAll("li label")
                                .attr("title", function (d, i) {
                                    return userGroupCapabilities (groupTypeData[i]);
                                })
                            ;
                        },
                        email: function (cellSel) {
                            cellSel
                                .select("span")
                                .attr("contenteditable", "true")
                                .on ("input", function() { signalContentChangeCell (d3.select(this), buttonEnablingLogic); })
                                .on ("keyup", function() { signalContentChangeCell (d3.select(this), buttonEnablingLogic); })
                                .on ("paste", function() { signalContentChangeCell (d3.select(this), buttonEnablingLogic); })
                            ;
                        },
                        update: buttonHook,
                        delete: buttonHook,
                        reset_Password: buttonHook,
                    }
                },
            };

            var applyHeaderStyling = function (headerSel, autoWidths, columnSettings) {
                var vcWidth = Math.floor (100.0 / Math.max (1, autoWidths.size() + 1))+"%";

                headerSel
                    .classed ("ui-state-default", true)
                    .filter (function(d) { return autoWidths.has(d.key); })
                    .classed ("varWidthCell", true)
                    .style ("width", vcWidth)
                ;

                headerSel
                    .filter (function(d) { return columnSettings[d.key].cellStyle; })
                    .each (function(d) {
                        d3.select(this).classed (columnSettings[d.key].celLStyle, true);
                    })
                ;
            };

            d3.values(tableSettings).forEach (makeIndTable);

            function makeIndTable (tableSetting) {
                var sel = d3.select (tableSetting.domid);
                var baseId = tableSetting.domid.slice(1)+"Table";

                var propertyNames = ["cellStyle", "dataToHTMLModifier", "tooltip", "cellD3EventHook"];
                [tableSetting.cellStyles, tableSetting.modifiers, tableSetting.simpleTooltips, tableSetting.cellD3Hooks].forEach (function (obj, i) {
                    d3.entries(obj).forEach (function (entry) {
                        columnSettings[entry.key][propertyNames[i]] = entry.value;
                    });
                });

                var d3tableContainer = d3.select(tableSetting.domid).append("div").attr("class", "d3tableContainer")
                    .datum({
                        data: tableSetting.data,
                        columnSettings: tableSetting.columnSettings,
                        columnOrder: d3.keys(tableSetting.columnSettings),
                    })
                ;

                var d3table = CLMSUI.d3Table ();
                d3table (d3tableContainer);
                applyHeaderStyling (d3table.getHeaderCells(), tableSetting.autoWidths, tableSetting.columnSettings);
                //console.log ("table", table);

                // set initial filters
                var keyedFilters = {};
                d3.keys(columnSettings).forEach (function (columnKey) {
                    keyedFilters[columnKey] = "";
                });

                d3table
                    .pageSize(10)
                    .typeSettings ("alphaArray", alphaArrayTypeSettings)	// extra data type
                    .filter(keyedFilters)
                    .orderKey("id")
                    .orderDir("desc")
                    .sort()
                    .postUpdate (function (rowSel) {
                        highlightRows (rowSel);
                        enableCells (rowSel);
                    })
                    .update();
                ;
            }

            /**
            * Test to see if updating jeopardises logged-in user's superuser status (dangerous as they can't undo it themselves)
            * @function
            * @inner
            * @memberof CLMSUI.buildUserAdmin
            * @param isSuperUser - logged-in user is currently a superuser
            * @param newData - the new data associated with the user
            * @returns true if at danger of removing superuser status
            */
             function areYouRemovingOwnSuperuserStatus (isSuperUser, newData, optionLists) {
                 //var danger = (isSuperUser && jsonObj.super_user === false && jsonObj.id === userId);
                 var danger = (isSuperUser && newData.id === userId);
                 if (danger) {
                     var set = d3.set (newData.user_group);
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
                /**
                * Update a user's data in the DB
                * @function
                * @inner
                * @memberof CLMSUI.buildUserAdmin
                * @param d - current data associated with user
                * @param optionLists - userGroup data
                */
                 updateUser: function (d, optionLists) {
                     var newData = {};
                     d3.entries(d).forEach (function (entry) {
                         if (entry.key !== "originalData") {
                             newData[entry.key] = entry.value;
                         }
                     });
                     var removingOwnSuperuserStatus = areYouRemovingOwnSuperuserStatus (isSuperUser, newData);

                     var updateUserAjax = makeAjaxFunction (
                         "php/updateUser.php",
                         newData,
                         getMsg("userDatabaseUpdateCatchall"),
                         function () {
                             //console.log ("updated obj", jsonObj);
                            delete d.originalData;
                            d.originalData = $.extend({}, d);
                            if (removingOwnSuperuserStatus) {
                                // This is easier than trying to persude DataTables to reveal the original rows in the table and remove them
                                location.reload();
                            } else {
                                signalContentChangeRow (d.id, buttonEnablingLogic);
                            }
                         }
                     );
                     if (removingOwnSuperuserStatus) {
                         CLMSUI.jqdialogs.areYouSureDialog ("popErrorDialog", getMsg("clientRevokeSuperuser"), getMsg("pleaseConfirm"), getMsg("proceedUpdate"), getMsg("cancel"), updateUserAjax);
                     } else {
                        updateUserAjax();
                     }
                 },

                /**
                * Delete a user from the DB
                * @function
                * @inner
                * @memberof CLMSUI.buildUserAdmin
                * @param d - current data associated with user
                */
                 deleteUser: function (d) {
                     var deletingID = d.id;
                     var selfDelete = deletingID == userId;

                     var deleteUserAjax = makeAjaxFunction (
                         "php/deleteUser.php",
                         {id: deletingID},
                         getMsg ("deleteCatchallError"),
                         function () {
                            d.delete = true;
                            d.originalData.delete = true;
                            d.originalData.email = "";
                            selfDelete ? window.location.replace (getMsg ("xiLogoutURL")) : signalContentChangeRow (deletingID, buttonEnablingLogic);
                         }
                     );

                     CLMSUI.jqdialogs.areYouSureDialog ("popErrorDialog", getMsg(selfDelete ? "clientDeleteYourself" : "clientDeleteUser"), getMsg("pleaseConfirm"), getMsg("proceedDelete"), getMsg("cancel"), deleteUserAjax);
                 },

                /**
                * Send a password reset request for a user
                * @function
                * @inner
                * @memberof CLMSUI.buildUserAdmin
                * @param d - current data associated with user
                */
                 reset_PasswordUser: function (d) {
                     var resetPasswordAjax = makeAjaxFunction (
                         "php/resetPasswordUser.php",
                         {id: d.id},
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
