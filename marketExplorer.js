/*!
 * Sections of code from https://github.com/jimpurbrick/crestexplorerjs
 *  Copyright 2012, CCP (http://www.ccpgames.com)
 *  Dual licensed under the MIT or GPL Version 2 licenses.
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.opensource.org/licenses/GPL-2.0
 *
 *  All other code is under the MIT license.
 *
*/


var endpoints;
var regions=Array();
var marketGroups;
var currentRegion;
var currentGroup;

(function ($, window, document) {

    "use strict";

    // Configuration parameters
    var redirectUri = "https://www.fuzzwork.co.uk/market/viewer2/";
    var clientId = "f8c9bd2520064883ba1af73fafc1e486"; // OAuth client id
    var csrfTokenName = clientId + "csrftoken";
    var hashTokenName = clientId + "hash";
    var scopes = "publicData";
    var baseURL = "https://crest-tq.eveonline.com";




    // Show error message in main data pane.
    function displayError(error) {
        $("#data").children().replaceWith("<span>" + error + "</span>");
    }

    // Request uri and render as HTML.
    function render(uri) {
        if (uri.indexOf("http") !== 0) {
            displayError("Addresses must be absolute");
            return;
        }
        $.getJSON(uri, function(data, status, xhr) {
            $("#data").children().replaceWith(buildElement(data));
            bindLinks();
        });
    }

    function loadEndpoints() {
        $.getJSON(baseURL,function(data,status,xhr) {
            window.endpoints=data;
            loadRegions();
            loadMarketGroups();
        });
    
    }

    function loadRegions() {

        $.getJSON(window.endpoints["regions"].href,function(data,status,xhr) {
            $.each(data['items'],function(index,value){
                if (!value.name.match('.-R00')) {
                   window.regions[value.name]=value.href;
                   $("#regionSelector").append("<option value='"+value.href+"'>"+value.name+"</option>");
                }
            });
            $("#regionSelect").show();
        });

    }

    function loadMarketGroups() {
        $.getJSON(window.endpoints["marketGroups"].href,function(data,status,xhr) {
            marketGroups=data.items;
            $.map(marketGroups,function(group){
                if (typeof group.parentGroup === 'undefined') {
                    $("#marketGroups").append("<li data-cresthref='"+group.href+"' class='groupLink'>"+group.name+"</li>");
                }
                }
            );
            $('.groupLink').click(function(event){event.stopPropagation();openSubGroup(event.target);});
            $("#marketgroupmain").show();
        });


    }
   
    function openSubGroup(group)
    {
        var node;
        var itemcount=0;
        if ($(group).children('ul').length>0) {
            $(group).children('ul').toggle();
        } else {
            $(group).append('<ul class="subdisplay"></ul>');
            node=$(group).children('ul');
            $.map(marketGroups,function(subgroup){
            if (typeof subgroup.parentGroup != 'undefined' && subgroup.parentGroup.href === group.dataset.cresthref) {
                node.append("<li data-cresthref='"+subgroup.href+"' class='groupLink'>"+subgroup.name+"</li>");
            }
            if (subgroup.href === group.dataset.cresthref) {
                $.getJSON(subgroup.types.href,function(data,status,xhr) {
                    $.map(data.items,function(item){
                        if (item.marketGroup.href== group.dataset.cresthref) {
                            node.append("<li data-cresthref='"+item.type.href+"' class='itemLink'><img width=16 height=16 src='"+item.type.icon.href+"'  data-cresthref='"+item.type.href+"'>"+item.type.name+"</li>");
                            itemcount++;
                        }
                    });
                    console.log(itemcount);
                    if (itemcount>0) {
                    console.log('items only');
                     $('.itemLink').click(function(event){event.stopPropagation();openItem(event.target);});
                    }
                });
            }
            });
        }
    }

    function openItem(item)
    {
        var buytable;
        var selltable;
        $('#MarketDisplay').show();
        console.log(item.dataset.cresthref);
        $.getJSON(item.dataset.cresthref,function(data,status,xhr) {
            $('#itemDescription').html(data.name+"<br>"+data.description);
        });
        if (typeof currentRegion != 'undefined') {
            buytable=$('#buy').DataTable();
            buytable.rows().remove();
            selltable=$('#sell').DataTable();
            selltable.rows().remove();
            $.getJSON(currentRegion.marketBuyOrders.href+'?type='+item.dataset.cresthref,function(data,status,xhr) {
                $.map(data.items,function(item){
                    buytable.row.add([item.location.name,$.number(item.volume_str),item.minVolume_str,$.number(item.price,2),item.range,moment(item.issued).add(item.duration,'days').format("YYYY-MM-DD HH:mm")]);
                });
                buytable.draw();

            })
            $.getJSON(currentRegion.marketSellOrders.href+'?type='+item.dataset.cresthref,function(data,status,xhr) {
                $.map(data.items,function(item){
                    selltable.row.add([item.location.name,$.number(item.volume_str),$.number(item.price,2),moment(item.issued).add(item.duration,'days').format("YYYY-MM-DD HH:mm")]);
                });
                selltable.draw();
            });
        } else {
            alert('Set a region to get data');
        }

    }

    function setLanguage() {
        var cookieok=confirm("This needs a cookie");
        if (cookieok){
            if ($("#language").val()=="Default") {
                $.cookie('market-language',null);
            } else {
                $.cookie('market-language',$("#language").val());
            }
        }
    }

    function loadRegionData() {
        $.getJSON($("#regionSelector").val(),function(data,status,xhr) {
            currentRegion=data;
        });
    }


    // Send Oauth token request on login, reset ajax Authorization header on logout.
    function onClickLogin(evt) {
        evt.preventDefault();
        var command = $("#login").text();
        if (command === "Login to Start Browsing the Market") {

            // Store CSRF token and current location as cookie
            var csrfToken = uuidGen();
            $.cookie(csrfTokenName, csrfToken);
            $.cookie(hashTokenName, window.location.hash);

            // No OAuth token, request one from the OAuth authentication endpoint
            window.location =  "https://login.eveonline.com/oauth/authorize/" +
                "?response_type=token" +
                "&client_id=" + clientId +
                "&scope=" + scopes +
                "&redirect_uri=" + redirectUri +
                "&state=" + csrfToken;

        } else {
            ajaxSetup(false);
            loginSetup(false);
        }
    }

    // Extract value from oauth formatted hash fragment.
    function extractFromHash(name, hash) {
        var match = hash.match(new RegExp(name + "=([^&]+)"));
        return !!match && match[1];
    }

    // Generate an RFC4122 version 4 UUID
    function uuidGen() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    }

    function ajaxSetup(token) {
        var headers = {
            "Accept": "application/json, charset=utf-8"
        };
        if (token) {
            headers.Authorization = "Bearer " + token;
        }
        if ($.cookie('market-language')) {
            headers['Accept-Language'] = $.cookie('market-language');
        }
        $.ajaxSetup({
            accepts: "application/json, charset=utf-8",
            crossDomain: true,
            type: "GET",
            dataType: "json",
            headers: headers,
            error: function (xhr, status, error) {
                displayError(error);
            }
        });
    }

    function loginSetup(token) {
        $("#login").click(onClickLogin);
    }

    $(document).ready(function() {

        var hash = window.location.hash;
        var token = extractFromHash("access_token", hash);
        $('#buy').DataTable({
            "paging": false,
            "scrollY": "40%",
            "bFilter": false,
            "bInfo": false,
            "bAutoWidth": false,
            "bSortClasses": false,
            "bDeferRender": false,
            "sDom": 'C<"clear">lfrtip',
            "order":[[3,"desc"]],
            "columnDefs": [ 
                { className: "dt-left"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"}
            ]
        
        });
        $('#sell').DataTable({
            "paging": false,
            "scrollY": "40%",
            "bFilter": false,
            "bInfo": false,
            "bAutoWidth": false,
            "bSortClasses": false,
            "bDeferRender": false,
            "sDom": 'C<"clear">lfrtip',
            "order":[[2,"asc"]],
            "columnDefs": [ 
                { className: "dt-left"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"}
            ]
        });
        
        $("#MarketDisplay").hide();

        if (token) {
            ajaxSetup(token);
            // Check CSRF token in state matches token saved in cookie
            if(extractFromHash("state", hash) !== $.cookie(csrfTokenName)) {
                displayError("CSRF token mismatch");
                return;
            }

            // Restore hash.
            window.location.hash = $.cookie(hashTokenName);

            // Delete cookies.
            $.cookie(csrfTokenName, null);
            $.cookie(hashTokenName, null);
            $("#login-window").hide();
            loadEndpoints();
        } else {
            $("#regionSelect").hide();
            $(".marketgroupmain").hide();
        }

        loginSetup(token);
        $("#regionSelector").change(function() {
            loadRegionData();
        })
        $("#language").change(function() {
            setLanguage();
        })
    });


}($, window, document)); // End crestexplorerjs
