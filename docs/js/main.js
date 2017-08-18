$(function(){

    var el = $("#photos");

    $.get("labels.json", function(data){
        var html = "";
        var items = JSON.parse(data);
        while (items.length){
            var item = items.pop();
            html += "<div class=\"thumbnail\"><p>" + item.labels.join(", ") + "</p><img class=\"photo\" alt=\"" + item.id + "\" src=\"photos/" + item.filename + "\"/></div>";
        }
        el.append(html);
    });

});