/*
 * This file is part of Report Portal.
 *
 * Report Portal is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Report Portal is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Report Portal.  If not, see <http://www.gnu.org/licenses/>.
 */
define(function (require, exports, module) {
    'use strict';

    var $ = require('jquery');
    var Backbone = require('backbone');
    var Epoxy = require('backbone-epoxy');
    var Components = require('core/components');
    var Service = require('coreService');
    var Localization = require('localization');
    var ModalChangePassword = require('modals/modalChangePassword');
    var ModalRegenerateUUID = require('modals/modalRegenerateUUID');
    var ModalEditUserInfo = require('modals/modalEditUserInfo');
    var ModalConfirm = require('modals/modalConfirm');
    var RegenerateUUIDTooltipView = require('tooltips/RegenerateUUIDTooltipView');
    var CallService = require('callService');
    var Urls = require('dataUrlResolver');
    var Util = require('util');
    var App = require('app');

    var config = App.getInstance();

    var UserProfileView = Components.BaseView.extend({
        tpl: 'tpl-user-profile-view',
        initialize: function(options) {
            this.$el = options.body;
            this.context = options.context;
            this.model = config.userModel;
            this.apiTokenModel = new Backbone.Model({
                apiToken: null,
            });
            this.listenTo(this.apiTokenModel, 'change:apiToken', this.setEditorValue);
            var self = this;
            Service.getApiToken()
                .done(function(data) {
                    self.apiTokenModel.set({apiToken: data.access_token});
                    self.$apiToken.val(data.access_token);
                })
                .fail(function() {
                    self.generateApiToken();
                });
            this.render();
        },
        bindings: {
            '[data-js-user-name]': 'text: fullName',
            '[data-js-user-email]': 'text: email',
            '[data-js-user-login]': 'text: user_login'
        },
        events: {
            'click [data-js-config-tab] li > a ': 'changeLangConfig',
            'click [data-js-change-password]': 'showChangePass',
            'click [data-js-edit-info]': 'showEditUserInfo',
            'change [data-js-select-photo]': 'previewPhoto',
            'submit [data-js-upload-photo-form]': 'uploadPhoto',
            'click [data-js-remove-photo]': 'removePhoto',
            'click [data-js-input-token]': 'selectToken',
            'click [data-js-update-token]': 'updateToken',
        },
        render: function() {
            this.model.ready.done(function () {
                var params = this.getParams();
                this.$el.html(Util.templates(this.tpl, params));
                this.setupAnchors();
                this.initEditor();
                this.loadRegenerateUUIDTooltip();
            }.bind(this));
            return this;
        },
        getParams: function(){
            var params = this.model.toJSON();
            params['certificateUrl'] = config.certificateUrl;
            params.image = Util.updateImagePath(params.image);
            params.apiToken = this.apiTokenModel.get('apiToken');
            return params;
        },
        setupAnchors: function(){
            this.$editPhotoBlock = $('[data-js-edit-photo]', this.$el);
            this.$uploadPhotoBlock = $('[data-js-upload-block]', this.$el);
            this.$wrongImageMessage = $('[data-js-photo-error]', this.$el);
            this.$imgSelector = $('[data-js-select-photo]', this.$el);
            this.$profileAvatar = $("[data-js-user-img]", this.$el);
            this.$editor = $('[data-js-editor]', this.$el);
            this.$certificate = $("[data-js-certificate]", this.$el);
            this.$apiToken = $('[data-js-input-token]', this.$el);
        },
        selectToken: function (ev) {
            $(ev.target).select();
        },
        loadRegenerateUUIDTooltip: function(){
            var el = $('[data-js-update-token]', this.$el);
            Util.appendTooltip(function() {
                var tooltip = new RegenerateUUIDTooltipView({});
                return tooltip.$el.html();
            }, el, el);
        },
        updateToken: function () {
            var self = this;
            (new ModalRegenerateUUID()).show().done(function(){
                return self.generateApiToken();
            });
        },
        showChangePass: function () {
            var modal = new ModalChangePassword({
                model: this.model
            });
            modal.show();
        },
        showEditUserInfo: function () {
            var modal = new ModalEditUserInfo({
                model: this.model
            });
            modal.show();
        },
        generateApiToken: function() {
            var self = this;
            Service.generateApiToken()
                .done(function (data) {
                    self.apiTokenModel.set({apiToken: data.access_token});
                    self.$apiToken.val(data.access_token);
                    Util.ajaxSuccessMessenger('updateUuid');
                })
                .fail(function (error) {
                    if (error.status !== 401) {
                        Util.ajaxFailMessenger(error, 'updateUuid');
                    }
                })
                .always(function () {
                    if(self.modalToken) {
                        self.modalToken.$el.modal('hide');
                    }
                });
        },
        previewPhoto: function (e) {
            var file = e.currentTarget.files[0],
                self = this;

            if (file) {
                if (this.validateFileExtension(file)) {
                    var reader = new FileReader();
                    var image = new Image();
                    reader.readAsDataURL(file);
                    reader.onload = function (_file) {
                        image.src = _file.target.result;
                        image.onload = function () {
                            if (self.validateImageSize(image, file)) {
                                self.$profileAvatar.attr('src', _file.target.result);
                                self.$editPhotoBlock.hide();
                                self.$uploadPhotoBlock.show();
                                self.$wrongImageMessage.hide().removeClass('shown');
                                //self.$profileAvatar.parent().removeClass('active');
                            } else {
                                self.$editPhotoBlock.show();
                                self.$uploadPhotoBlock.hide();
                                self.$wrongImageMessage.show().addClass('shown');
                            }
                        }
                    }
                } else {
                    this.$wrongImageMessage.show();
                }
            }
        },
        validateImageSize: function (image, file) {
            var width = image.width,
                height = image.height,
                size = ~~(file.size / 1024);
            return size <= 1000
                && width <= 300
                && height <= 500;
        },
        validateFileExtension: function (file) {
            return (/\.(gif|jpg|jpeg|png)$/i).test(file.name)
        },
        uploadPhoto: function (e) {
            var formData = new FormData();
            formData.append('file', this.$imgSelector[0].files[0]);

            var xhr = new XMLHttpRequest();
            var self = this;
            var srcPhoto = '';

            xhr.onreadystatechange = function () {
                self.$editPhotoBlock.show();
                self.$uploadPhotoBlock.hide();
                if (xhr.readyState === 4 && xhr.status === 200) {
                    srcPhoto = self.$profileAvatar.attr('src');
                    $("#profileImage").attr('src', srcPhoto);
                    config.userModel.set('photo_loaded', true);
                    self.$profileAvatar.parent().addClass('active');
                    self.$imgSelector.wrap('<form></form>').parent().trigger('reset').children().unwrap('<form></form>');
                    Util.setProfileUrl();
                    Util.ajaxSuccessMessenger('submitUpload');
                    config.trackingDispatcher.profilePhotoUploaded();
                } else if (xhr.readyState === 4 && xhr.status !== 200) {
                    Util.ajaxFailMessenger(null, 'submitUpload');
                }
            };
            xhr.open('POST', Util.updateImagePath(Urls.uploadPhoto()), true);
            xhr.send(formData);
            e.preventDefault();
        },
        removePhoto: function (e) {
            var self = this;
            var modal = new ModalConfirm({
                headerText: Localization.dialogHeader.deleteImage,
                bodyText: Localization.dialog.deleteImage,
                cancelButtonText: Localization.ui.cancel,
                okButtonText: Localization.ui.delete,
                confirmFunction: function() {
                    return CallService.call('DELETE', Urls.uploadPhoto()).done(function() {
                        config.userModel.set('photo_loaded', false);
                        Util.setProfileUrl();

                        $("#profileImage").attr('src', config.userModel.get('image'));
                        self.$profileAvatar.attr('src', config.userModel.get('image'));
                        self.$profileAvatar.parent().removeClass('active');
                        self.$wrongImageMessage.hide().removeClass('shown');
                        Util.ajaxSuccessMessenger("deletePhoto");
                    }).fail(function(error) {
                        Util.ajaxFailMessenger(error, "deletePhoto");
                    });
                }
            });
            modal.show();
        },
        changeLangConfig: function (e) {
            e.preventDefault();
            var el = $(e.target);
            if (!el.parent().hasClass('active')) {
                var elem = el.attr("href") || el.find('a').attr('href');
                this.lang = _.last(elem.split('#'));
                $('li', el.closest('ul')).removeClass('active');
                el.parent().addClass('active');
                this.setEditorValue();

                var action = this.lang === 'testng' ? 'show' : 'hide';
                this.$certificate[action]();
            }
        },
        initEditor: function () {
            this.setEditorValue();
        },
        setEditorValue: function(){
            if (this.$editor) {
                var value;
                //var oldClientComment = Localization.userProfile.oldClientComment;

                switch (this.lang) {
                    case 'ruby':
                        value =
                            '<h1>'+Localization.userProfile.rubyConfigTitle+'</h1>' +
                            '<br>'+
                            '<div class="options">'+
                                // '<p>username: ' + this.user.get('name') + '</p>' +
                            '<p>password: ' + this.apiTokenModel.get('apiToken') + '</p>' +
                            '<p>endpoint: ' + document.location.origin + '/api/v1' + '</p>' +
                            '<p>project: ' + this.model.get('defaultProject') + '</p>' +
                            '<p>launch: ' + this.model.get('name') + '_TEST_EXAMPLE</p>' +
                            '<p>tags:  [tag1, tag2]</p>' +
                            '</div>'
                        break;
                    case 'soap':
                        value =
                            '<h1>'+Localization.userProfile.soapConfigTitle+'</h1>' +
                            '<br>' +
                            '<div class="options">' +
                                // '<p>rp.username = ' + this.model.get('name') + '</p>' +
                            '<p>rp.uuid = ' + this.apiTokenModel.get('apiToken') + '</p>' +
                            '<p>rp.endpoint = ' + document.location.origin + '</p>' +
                            '<br>' +
                            '<p>rp.launch = ' + this.model.get('name') + '_TEST_EXAMPLE</p>' +
                            '<p>rp.project = ' + this.model.get('defaultProject') + '</p>' +
                            '<p>rp.tags = TAG1;TAG2</p>' +
                            '</div>';
                        break;
                    case '.net':
                        value =
                            '<h1>'+Localization.userProfile.dotnetConfigTitle+'</h1>';
                        break;
                    default:
                        value =
                            '<h1>'+Localization.userProfile.defaultConfigTitle+'</h1>' +
                            '<h1>'+Localization.userProfile.required+'</h1>' +
                            '<div class="options">'+
                            '<p>rp.endpoint = ' + document.location.origin + '</p>' +
                                // '<p>rp.username = ' + this.model.get('name') + '</p>' +
                            '<p>rp.uuid = ' + this.apiTokenModel.get('apiToken') + '</p>' +
                            '<p>rp.launch = ' + this.model.get('name') + '_TEST_EXAMPLE</p>' +
                            '<p>rp.project = ' + this.model.get('defaultProject') + '</p>' +
                            '<p>rp.keystore.resource = reportportal-client-v2.jks</p>' +
                            '<p>rp.keystore.password = reportportal</p>' +
                            '</div>' +
                            '<h1>'+Localization.userProfile.notRequired+'</h1>' +
                            '<div class="options"'+
                            '<p>rp.enable = true</p>' +
                            '<p>rp.tags = TAG1;TAG2</p>' +
                            '<p>rp.convertimage = true</p>' +
                            '<p>rp.mode = DEFAULT</p>' +
                            '<p>rp.skipped.issue = true</p>' +
                            '<p>rp.batch.size.logs = 20</p>' +
                            '</div>';
                        break;
                }
                this.$editor.html(value);
            }

        },
        destroy: function () {
            this.$el.html('');
            this.undelegateEvents();
            this.stopListening();
            this.unbind();
            delete this;
        }
    });

    return  UserProfileView;
});
