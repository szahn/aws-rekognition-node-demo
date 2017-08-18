$(function(){

    var el = $("#photos");

    $.get("labels.json", function(data){
        var html = "";
        while (data.length){
            var item = data.pop();
            html += "<div class=\"thumbnail\"><p>" + item.labels.join(", ") + "</p><img class=\"photo\" alt=\"" + item.id + "\" src=\"photos/" + item.filename + "\"/></div>";
        }
        el.append(html);
    });

});