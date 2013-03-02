(function ($) {
    var methods = {
        init: function (options) {
            return this.each(function () {
                var $this = $(this)
                var data = $this.data('saveyour');
                var settings = $.extend({
                    // these are default options ...
                    tableName: null,
                    primaryKeys: "",
                    recordKeyValue: '',
                    procedureName: null,
                    baseUrl: 'Services/SaveData.aspx',
                    saveClass: 'saveMe',
                    saveButtonIdentifier: '.saveButton',
                    saveButton: null,
                    needToSave: false,
                    validateClass: 'validate',
                    callback: null,
                    autoSave: true
                }, options); // ... which can be overwritten by passed values

                // If the plugin hasn't been initialized yet
                if (!data) {
                    if ((settings.tableName == null) && (settings.procedureName == null)) { // required!
                        $.error('No tableName or procedureName defined on jQuery.saveyour');
                    }

                    // setup and hookup the save button 
                    settings.saveButton = $this.find(settings.saveButtonIdentifier);
                    settings.saveButton.button({ icons: { primary: 'ui-icon-check' }, text: false, disabled: true }).click(function () {
                        methods.save($this);
                    });

                    // and hook up each control to do something (click/change)
                    $this.find("input:text." + settings.saveClass).change(function () {
                        if (settings.autoSave) methods.save($this);
                    }).keyup(function () {
                        methods.needToSave($this);
                    });
                    $this.find("input:checkbox." + settings.saveClass).click(function () {
                        if (settings.autoSave) {
                            methods.save($this);
                        } else {
                            methods.needToSave($this);
                        }
                    });
                    $this.find("textarea." + settings.saveClass).change(function () {
                        if (settings.autoSave) {
                            methods.save($this);
                        } else {
                            methods.needToSave($this);
                        }
                    }).keyup(function () {
                        methods.needToSave($this);
                    });
                    $this.find("select." + settings.saveClass).change(function () {
                        if (settings.autoSave) {
                            methods.save($this);
                        } else {
                            methods.needToSave($this);
                        }
                    });
                    $this.find("div." + settings.saveClass).find("input:radio").click(function () {
                        if (settings.autoSave) {
                            methods.save($this);
                        } else {
                            methods.needToSave($this);
                        }
                    });

                    $(this).data('saveyour', {
                        target: $this,
                        settings: settings
                    });
                }

            });
        },
        destroy: function () {
            return this.each(function () {
                $(this).removeData('saveyour');
            })
        },
        save: function (_this) {
            var data = _this.data('saveyour'),
                settings = data.settings,
                btn = settings.saveButton;
            var isValid = methods.validateControls(_this);
            if (!isValid) return;
            saveData(_this);

        },
        needToSave: function (_this) {
            var data = _this.data('saveyour'),
                settings = data.settings,
                btn = settings.saveButton;
            if (btn) {
                if (btn.button("option", "icons")) {
                    btn.button("option", "icons", { primary: "ui-icon-notice" });
                }
                btn.button("option", "disabled", false).attr("title", "Need to Save");
            }
            settings.needToSave = true;
        },
        getSaveButton: function () {
            return $(this).data('saveyour').settings.saveButton;
        },
        validateControls: function (_this) {
            var validateOK = true;
            var data = _this.data('saveyour'),
                settings = data.settings;
            // no validator yet for radio list? check box? or hidden?  oh well ... create if needed!
            _this.find("input:text." + settings.validateClass).each(function (index) {
                if (!ValidateText($(this))) validateOK = false;
            });
            _this.find("textarea." + settings.validateClass).each(function (index) {
                if (!ValidateTextArea($(this))) validateOK = false;
            });
            _this.find("select." + settings.validateClass).each(function (index) {
                if ($(this).hasClass("required") && ($(this).val() == "")) {
                    validateOK = false;
                    $(this).next(".validator").show();
                }
                else {
                    $(this).next(".validator").hide();
                }
            });
            return validateOK;
        }
    };

    function saveData(_this) {
        var data = _this.data('saveyour'),
            settings = data.settings;

        // set to false. if true at the end, something has changed in the interrim
        settings.needToSave = false;

        var dataToSave = {
            tableName: settings.tableName,
            primaryKeys: settings.primaryKeys
        };
        _this.find("." + settings.saveClass).each(function (index) {
            var fieldData = FieldData($(this));
            $.extend(dataToSave, fieldData);
        });
        var url = settings.baseUrl;
        $.post(url, dataToSave, function (data) {
            if (data == "OK") {
                if (settings.saveButton) {
                    if (settings.saveButton.button("option", "icons")) {
                        settings.saveButton.button("option", "icons", { primary: "ui-icon-check" });
                    }
                    settings.saveButton.button("option", "disabled", true).attr("title", "Saved");
                }
                if (settings.needToSave) { // if something has changed during the save process, need to save again.
                    saveData(_this);
                } else if (settings.callback) {
                    settings.callback();
                }
            }
        });

    }
    function FieldData(ctl) {
        var tag = ctl[0].nodeName.toLowerCase();
        var fieldName = ctl.data("fieldname");
        var fieldValue;
        var escpd = false;
        if (tag == "div") {
            var radioSelected = ctl.find("input:checked"); // for the radio that is checked ...
            if (radioSelected.length > 0) {
                // fieldName = ctl.data("fieldname") ? ctl.data("fieldname") : radioSelected.attr("name");
                fieldValue = radioSelected.val();
                if ((fieldValue == "") && $(this).attr("data-emptysubst")) {
                    fieldValue = $(this).data("emptysubst");
                }
            }
        } else if (tag == "input") {
            if (ctl.attr("type") == "checkbox") {
                fieldValue = $(this).prop("checked") ? "1" : "0";
            } else {
                fieldValue = ctl.val();
            }
        } else if (tag == "select") {
            fieldValue = ctl.val();
        } else if (tag == "textarea") {
            fieldValue = "%ESC:'" + encodeURI(ctl.val()).replace(/'/g, "''") + "'";
            escpd = true;
        }

        // if we have a watermark, check to make sure the text isn't just the watermark, if it is, set it to blank
        if (ctl.hasClass("wm") && (ctl.attr("title") == fieldValue)) {
            fieldValue = "";
        }

        // if the value is blank and we have an empty substitution ... do it.
        if ((ctl.data("emptysubst") != undefined) & (fieldValue == "")) {
            fieldValue = ctl.data("emptysubst");
        }
        else if (ctl.data("formatstring") != null) { // if the data needs to be formatted (integers get "{0}") Strings handled below
            fieldValue = ctl.data("formatstring").replace("{0}", fieldValue).replace(/,/g, "").replace(/$/g, ""); // removing $ and , characters, which will screw things up in numeric fields
        } else if (!escpd) {
            fieldValue = "'" + fieldValue + "'"; // likely text, wrap in single quotes
        }


        // by doing this one at a time, I improve debugging and can see where things fail
        var evalThis = '( {"' + fieldName + '" : "' + fieldValue + '"} )';
        var fieldData = eval(evalThis);
        return fieldData;
    }
    function ValidateText(txt) {
        var isOk = true;
        if (txt.hasClass("validate")) {
            var ctrlValue = txt.val();
            if (txt.hasClass("wm") && (txt.attr("title") == ctrlValue)) { // if we have a watermark, check to make sure the text isn't just the watermark
                ctrlValue = ""; // set to blank if there is a watermark and the text is the watermark
            }
            if (txt.hasClass("required") && (ctrlValue == "")) {
                isOk = false;
            }
            else if (!txt.hasClass("required") && (ctrlValue == "")) {
                isOk = true;
            }
            else {
                if (txt.hasClass("isInteger")) {
                    isOk = isInteger(ctrlValue);
                }
                else if (txt.hasClass("isWhole")) {
                    isOk = isWholeNumber(ctrlValue);
                }
                else if (txt.hasClass("isByte")) {
                    isOk = isByte(ctrlValue);
                }
                else if (txt.hasClass("isNonNegNumber")) {
                    isOk = isNonNegNumber(ctrlValue);
                }
                else if (txt.hasClass("isNumber")) {
                    if (isNaN(ctrlValue)) {
                        isOk = false;
                    }
                }
                else if (txt.hasClass("isDate")) {
                    isOk = isDate(ctrlValue);
                }
                else if (txt.hasClass("isTime")) {
                    isOk = isTime(ctrlValue);
                }
            }
            txt.next(".validator").toggle(!isOk);
        }
        return isOk;
    }
    function ValidateTextArea(txt) {
        var isOk = true;
        if (txt.hasClass("validate")) {
            var ctrlValue = txt.val();
            if (txt.hasClass("wm") && (txt.attr("title") == ctrlValue)) { // if we have a watermark, check to make sure the text isn't just the watermark
                ctrlValue = ""; // set to blank if there is a watermark and the text is the watermark
            }
            if (txt.hasClass("required") && (ctrlValue == "")) {
                isOk = false;
            }
            else if (!txt.hasClass("required") && (ctrlValue == "")) {
                isOk = true;
            }
            else if (!isNaN(txt.data("maxlength"))) {
                isOk = (ctrlValue.length <= Number(txt.data("maxlength")));
            }
            if (txt.data("validator") != null) {
                $("#" + txt.data("validator")).toggle(!isOk);
            }
            else {
                txt.next(".validator").toggle(!isOk);
            }
        }
        return isOk;
    }
    function isInteger(n) {
        return (/^-?\d+$/.test(n));
    }
    function isWholeNumber(n) {
        return (/^\d+$/.test(n));
    }
    function isByte(n) {
        return (/^\d+$/.test(n) && (Number(n) < 256));
    }
    function isNonNegNumber(n) {
        return (!isNaN(n) && (n >= 0));
    }
    function isDate(dateTest) {
        if (dateTest == null) return false;
        dateTest.replace("-", "/").replace(".", "/");
        var dSplit = dateTest.split("/");
        if (!(dSplit[0].length == 1 || dSplit[0].length == 2)) return false;
        if (!(dSplit[1].length == 1 || dSplit[1].length == 2)) return false;
        if (dSplit[2].length != 4) return false;
        // the second parameter specifies base 10, otherwise leading zeros in "08" and "09" imply conversion to octal, and these numbers don't exist in octal
        var m = parseInt(dSplit[0], 10) - 1;  // javascript months are zero-based
        var d = parseInt(dSplit[1], 10);
        var y = parseInt(dSplit[2], 10);
        var dateAssembled = new Date(y, m, d);
        return ((d == dateAssembled.getDate()) && (m == dateAssembled.getMonth()) && (y == dateAssembled.getFullYear()));
    }

    function isTime(timeStr) {
        // this is intended for use with timeWorkDay to automatically format, but that will still allow for invalid times, just need to make sure!
        var timePat = /^(\d{1,2}):(\d{2})(:(\d{2}))?(\s?(AM|am|PM|pm))?$/;
        var matchArray = timeStr.match(timePat);
        if (matchArray == null) return false;
        hour = matchArray[1];
        minute = matchArray[2];
        //second = matchArray[4];
        //ampm = matchArray[6];
        //if (second == "") { second = null; }
        //if (ampm == "") { ampm = null }
        if (hour < 0 || hour > 12) return false;   // use in conjunction with timeWorkDay to format/assume time .. military will convert to am/pm automatically
        if (minute < 0 || minute > 59) return false;
        // if (second != null && (second < 0 || second > 59)) return false;
        return true;
    }

    $.fn.saveyour = function (method) {
        // Method calling logic
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.saveyour');
        }

    };
})(jQuery);

