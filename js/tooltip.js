var CLMSUI = CLMSUI || {};

CLMSUI.tooltip = new function () {
    this.holdDuration = 10000;
    this.fadeDuration = 200;
    var mouseOffset = 10;
    var self = this;
    var _elemID;

    this.init = function (elemID) {
        _elemID = elemID;
        var tooltip = d3.select("body").selectAll("#"+elemID).data([0])
            .enter()
            .append("div")
                .attr ("id", elemID)
                .attr ("class", "mgTooltip")
                .style ("visibility", "hidden")
        ;
        tooltip.append("h2");
        tooltip.append("p");
        return this;
    };

    this.setToFade = function () {
        var tooltip = d3.select("#"+_elemID);
        tooltip
            .transition()
            .duration (self.fadeDuration)
            .style ("opacity", 0)
            .each ("end", function () {
                d3.select(this).style ("visibility", "hidden");
            })
        ;
        return this;
    };

    this.updateText = function (title, str) {
        var tooltip = d3.select("#"+_elemID);
        tooltip.select("h2").text(title);
        tooltip.select("p").html(str);
        tooltip
            .transition()
            .style ("visibility", "visible")
            .style ("opacity", null)
            .transition()
            .duration(self.holdDuration)
            .each ("end", function() {
                self.setToFade();
            })
        ;
        return this;
    };

    this.updatePosition = function (e) {
        if (e) {
            // need the following measurements to ensure tooltip stays within visible and current bounds of document
            var tooltip = d3.select("#"+_elemID);
            var jqelem = $("#"+_elemID);
            
            var doc = $(document);
            var win = $(window);
            var dw = doc.width();
            var dh = doc.height();
            var ww = win.width();
            var wh = win.height();
            var sx = win.scrollLeft();
            var sy = win.scrollTop();

            var tx = e.pageX;
            var ty = e.pageY;
            var tw = $.zepto ? jqelem.width() : jqelem.outerWidth();  // outerWidth in JQuery, width in Zepto
            var th = $.zepto ? jqelem.height() : jqelem.outerHeight(); // ditto, but for height

            var allDefinedAndNonZero = (dw && dh && tw && th && ww && wh); // test all widths/heights are non-zero and defined
            var newtx, newty;

            if (allDefinedAndNonZero) {
                var roomBelow = ty + th + mouseOffset < Math.min (dh, wh + sy);
                newty = roomBelow ? ty + mouseOffset : ty - th - mouseOffset;

                var roomRight = tx + tw + mouseOffset < Math.min (dw, ww + sx);
                newtx = roomRight ? tx + mouseOffset : tx - tw - mouseOffset;
            } else {
                newtx = tx;
                newty = ty;
            }
            
             tooltip.style("left",newtx+"px").style("top",newty+"px");
        }
        return this;
     };

    return this;
}();