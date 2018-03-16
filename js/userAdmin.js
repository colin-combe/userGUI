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
		
		function fillInMissingFields (data) {
			var replacements = {
				email: "",
				delete: false
			};
			var replacementEntries = d3.entries (replacements);
			data.forEach (function (userDatum) {
				replacementEntries.forEach (function (rentry) {
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

                return makeAjaxFunction (
                    "php/readUsers.php", 
                    null, 
                    getMsg ("databaseConnectError"),
                    function (response) {
                        d3.select("#username").text(response.username);
						fillInMissingFields (response.data);
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

        function d3SelectParent (elem) {
            return d3.select (elem.parentNode);
        }
		
		function selectRowByID (rowID) {
			return d3.select("#userTable tbody").selectAll("tr").filter(function(d) { return d.id === rowID; })
		}

        function truthy (val) {
            return val === "t" || val === "y" || val === true;
        }

		
        function equals (d) {
			var dv = d.value[d.key];
			var dov = d.value.originalData[d.key];
            if ($.isArray(dv) && $.isArray(dov)) {
                return $(dv).not(dov).length === 0 && $(dov).not(dv).length === 0;
            }
            return dv === dov;
		}

        function isDatumValid (d, isSuperUser) {
            var reg = CLMSUI.regExpPatterns[d.key];
            return !reg || reg.test(d.value[d.key] || "") || (isSuperUser && !d.value[d.key]);    // superusers can enter empty values
        }

        function isOriginalDatumValid (d, isSuperUser) {
            var reg = CLMSUI.regExpPatterns[d.key];
            return !reg || reg.test(d.value.originalData[d.key] || "") || (isSuperUser && !d.value.originalData[d.key]);    // superusers can enter empty values
        }

        // Enable a button dependent on a test (found in buttonEnablingLogic)
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

        function indicateValidValues (sel, isSuperUser) {
            sel = sel || d3.selectAll("table tbody").selectAll("td");
            sel.each (function(d) {
                var invalid = !isDatumValid (d, isSuperUser);
                d3.select(this).classed("invalid", invalid);
            });
        }
		
		function indicateChangedValues (sel) {
            sel = sel || d3.selectAll("table tbody").selectAll("td");
            sel.classed ("changedValue", function(d) { return !equals (d); });
        }

        function signalContentChangeCell (singleCellSel, buttonEnablingLogic) {
			var d = singleCellSel.datum();
            d.value[d.key] = singleCellSel.text();
            indicateValidValues (singleCellSel);
            indicateChangedValues (d3SelectParent(singleCellSel.node()));   // up to td not span element
            enableButton (d.value, "update", buttonEnablingLogic);
        }

        function setRowIndicators (singleRowSelection, buttonEnablingLogic) {
            indicateChangedValues (singleRowSelection.selectAll("td"));
			var d = singleRowSelection.datum();
            enableButton (d, "update", buttonEnablingLogic);
            enableButton (d, "delete", buttonEnablingLogic);
            enableButton (d, "reset_Password", buttonEnablingLogic);
        }
		
		// Used when entire row content check needs done i.e. after database update
        function signalContentChangeRow (id, buttonEnablingLogic) {
            setRowIndicators (selectRowByID (id), buttonEnablingLogic);
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
				 rowSel.each (function (d) { setRowIndicators (d3.select(this), buttonEnablingLogic); })	
			 }
			 
			 var columnMetaData = [
				{name: "ID", type: "numeric", tooltip: "", visible: isSuperUser, removable: true, id: "id"},
				{name: "You", type: "boolean", tooltip: "", visible: isSuperUser, removable: true, id: "you"},
				{name: "User Name", type: "alpha", tooltip: "", visible: true, removable: false, id: "user_name"},
				{name: "User Group", type: "alphaArray", tooltip: "", visible: true, removable: true, id: "user_group"},
				{name: "Email", type: "alpha", tooltip: "", visible: true, removable: true, id: "email"},
				{name: "Update", type: "boolean", tooltip: "", visible: true, removable: true, id: "update"},
				{name: "Reset Password", type: "none", tooltip: "", visible: true, removable: true, id: "reset_Password"},
				{name: "Delete", type: "none", tooltip: "", visible: true, removable: true, id: "delete"},
			];
			 
			 var headerEntries = columnMetaData.map (function (cmd) {
				 return {key: cmd.id, value: cmd};
			 });
			 
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
					headerEntries: headerEntries,
					modifiers: {
						you: function (d) { return d.you ? "<span class='ui-icon ui-icon-person'></span>" : ""; },
						user_group: function (d) { return "<select></select>"; },
						email: function (d) { return "<span>"+d.email+"</span><span class='ui-icon ui-icon-pencil'></span>"; },
						update: function (d) { return "<button>Update</button>"; },
						reset_Password: function (d) { return "<button>Reset Password</button>"; },
						delete: function (d) { return "<button>Delete "+(userId === d.id ? " Me" : " User")+"</button>"; },
					},
					cellStyles: {user_group: "fitMultipleSelect"},
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
									return typeCapabilities (groupTypeData[i]);
								})
							;
						},
						email: function (cellSel) {
							cellSel
								.select("span")
								.attr("contenteditable", "true")
								.on ("input", function(d) { signalContentChangeCell (d3.select(this), buttonEnablingLogic); })
								.on ("keyup", function(d) { signalContentChangeCell (d3.select(this), buttonEnablingLogic); })
								.on ("paste", function(d) { signalContentChangeCell (d3.select(this), buttonEnablingLogic); })
							;
						},
						update: function (cellSel) { buttonHook (cellSel); },
						delete: function (cellSel) { buttonHook (cellSel); },
						reset_Password: function (cellSel) { buttonHook (cellSel); },
					}
                },
            };
			 
			var applyHeaderStyling = function (headerSel, autoWidths, cellStyles) {
				var vcWidth = Math.floor (100.0 / Math.max (1, autoWidths.size() + 1))+"%";

				headerSel
					.classed ("ui-state-default", true)
					.filter (function(d) { return autoWidths.has(d.key); })
					.classed ("varWidthCell", true)
					.style ("width", vcWidth)
				;
				
				headerSel
					.filter (function(d) { return cellStyles[d.key]; })
					.each (function(d) {
						d3.select(this).classed (cellStyles[d.key], true);
					})
				;
			};

            d3.values(tableSettings).forEach (function (tableSetting) { makeIndTable (tableSetting); });

            function makeIndTable (tableSetting) {
                var sel = d3.select (tableSetting.domid);
                var baseId = tableSetting.domid.slice(1)+"Table";
				
				var d3tab = d3.select(tableSetting.domid).append("div").attr("class", "d3tableContainer")
					.datum({
						data: tableSetting.data, 
						headerEntries: tableSetting.headerEntries, 
						cellStyles: tableSetting.cellStyles,
						cellD3Hooks: tableSetting.cellD3Hooks,
						columnOrder: tableSetting.headerEntries.map (function (hentry) { return hentry.key; }),
					})
				;
				
				var modifiers = tableSetting.modifiers;
				
				var table = CLMSUI.d3Table ();
				table (d3tab);
				applyHeaderStyling (table.getHeaderCells(), tableSetting.autoWidths, tableSetting.cellStyles);
				console.log ("table", table);

				// set initial filters
				var keyedFilters = {};
				headerEntries.forEach (function (hentry) {
					keyedFilters[hentry.key] = {value: "", type: hentry.value.type}	
				});

				table
					.pageSize(10)
					.typeSettings ("alphaArray", alphaArrayTypeSettings)
					.filter(keyedFilters)
					.orderKey("id")
					.sort()
					.dataToHTML (modifiers)
					.postUpdate (function (rowSel) {
						highlightRows (rowSel);
						enableCells (rowSel);
					})
				;

				table.update();
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
                 updateUser: function (d, optionLists) {
                     var jsonObj = {};
                     d3.entries(d).forEach (function (entry) {
						 if (entry.key !== "originalData") {
                         	jsonObj[entry.key] = entry.value;
						 }
                     });
                     var removingOwnSuperuserStatus = areYouRemovingOwnSuperuserStatus (isSuperUser, jsonObj);

                     var updateUserAjax = makeAjaxFunction (
                         "php/updateUser.php", 
                         jsonObj, 
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